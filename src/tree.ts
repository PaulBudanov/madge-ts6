'use strict';

import os = require('os');
import path = require('path');
import fs = require('fs');
import {promisify} from 'util';
import log = require('./log');

const commondir = require('commondir') as (dirs: string[]) => string;
const walk = require('walkdir') as {
	sync: (srcPath: string, callback: (filePath: string, stats: fs.Stats) => void) => void;
};
const dependencyTree = require('dependency-tree') as (options: DependencyTreeOptions) => NestedDependencyTree;

const stat = promisify(fs.stat);

type ModuleDependencyTree = Record<string, string[]>;
type DependencyFilter = (dependencyFilePath: string, traversedFilePath: string, baseDir: string) => boolean | void;

interface NestedDependencyTree {
	[key: string]: NestedDependencyTree;
}

interface TreeBuildResult {
	tree: ModuleDependencyTree;
	skipped: string[];
}

interface TreeConfig {
	baseDir: string | null;
	excludeRegExp: string[] | false;
	fileExtensions: string[];
	includeNpm: boolean;
	requireConfig: unknown;
	webpackConfig: unknown;
	tsConfig: unknown;
	dependencyFilter: DependencyFilter | false;
	detectiveOptions?: unknown;
}

interface DependencyTreeOptions {
	filename: string;
	directory: string;
	requireConfig: unknown;
	webpackConfig: unknown;
	tsConfig: unknown;
	visited: Record<string, unknown>;
	filter: (dependencyFilePath: string, traversedFilePath: string) => boolean;
	detective: unknown;
	nonExistent: string[];
}

/**
 * Check if running on Windows.
 */
const isWin = (os.platform() === 'win32');

class TreeBuilder {
	private readonly srcPaths: string[];
	private readonly config: TreeConfig;
	private baseDir = '';

	constructor(srcPaths: string[], config: TreeConfig) {
		this.srcPaths = srcPaths.map((srcPath) => path.resolve(srcPath));
		log('using src paths %o', this.srcPaths);

		this.config = config;
		log('using config %o', this.config);
	}

	build(): Promise<TreeBuildResult> {
		return this.getDirs()
			.then(this.setBaseDir.bind(this))
			.then(this.getFiles.bind(this))
			.then(this.generateTree.bind(this));
	}

	/**
	 * Set the base directory (compute the common one if multiple).
	 */
	private setBaseDir(dirs: string[]): void {
		if (this.config.baseDir) {
			this.baseDir = path.resolve(this.config.baseDir);
		} else {
			this.baseDir = commondir(dirs);
		}

		log('using base directory %s', this.baseDir);
	}

	/**
	 * Get directories from the source paths.
	 */
	private getDirs(): Promise<string[]> {
		return Promise
			.all(this.srcPaths.map((srcPath) => {
				return stat(srcPath)
					.then((stats) => stats.isDirectory() ? srcPath : path.dirname(path.resolve(srcPath)));
			}));
	}

	/**
	 * Get all files found from the source paths.
	 */
	private getFiles(): Promise<string[]> {
		const files: string[] = [];

		return Promise
			.all(this.srcPaths.map((srcPath) => {
				return stat(srcPath)
					.then((stats) => {
						if (stats.isFile()) {
							if (this.isGitPath(srcPath)) {
								return;
							}

							files.push(path.resolve(srcPath));

							return;
						}

						walk.sync(srcPath, (filePath, fileStats) => {
							if (this.isGitPath(filePath) || this.isNpmPath(filePath) || !fileStats.isFile()) {
								return;
							}

							const ext = path.extname(filePath).replace('.', '');

							if (files.indexOf(filePath) < 0 && this.config.fileExtensions.indexOf(ext) >= 0) {
								files.push(filePath);
							}
						});
					});
			}))
			.then(() => files);
	}

	/**
	 * Generate the tree from the given files.
	 */
	private generateTree(files: string[]): TreeBuildResult {
		const depTree: NestedDependencyTree = {};
		const visited: Record<string, unknown> = {};
		const nonExistent: string[] = [];
		const npmPaths: Record<string, string[]> = {};
		const pathCache: Record<string, string> = {};

		files.forEach((file) => {
			if (visited[file]) {
				return;
			}

			Object.assign(depTree, dependencyTree({
				filename: file,
				directory: this.baseDir,
				requireConfig: this.config.requireConfig,
				webpackConfig: this.config.webpackConfig,
				tsConfig: this.config.tsConfig,
				visited: visited,
				filter: (dependencyFilePath, traversedFilePath) => {
					let dependencyFilterRes: boolean | void = true;
					const isNpmPath = this.isNpmPath(dependencyFilePath);

					if (this.isGitPath(dependencyFilePath)) {
						return false;
					}

					if (this.config.dependencyFilter) {
						dependencyFilterRes = this.config.dependencyFilter(dependencyFilePath, traversedFilePath, this.baseDir);
					}

					if (this.config.includeNpm && isNpmPath) {
						(npmPaths[traversedFilePath] = npmPaths[traversedFilePath] || []).push(dependencyFilePath);
					}

					return !isNpmPath && (dependencyFilterRes || dependencyFilterRes === undefined);
				},
				detective: this.config.detectiveOptions,
				nonExistent: nonExistent
			}));
		});

		let tree = this.convertTree(depTree, {}, pathCache);

		for (const npmKey in npmPaths) {
			const id = this.processPath(npmKey, pathCache);
			tree[id] = tree[id] || [];

			npmPaths[npmKey].forEach((npmPath) => {
				tree[id].push(this.processPath(npmPath, pathCache));
			});
		}

		if (this.config.excludeRegExp) {
			tree = this.exclude(tree, this.config.excludeRegExp);
		}

		return {
			tree: this.sort(tree),
			skipped: nonExistent
		};
	}

	/**
	 * Convert deep tree produced by dependency-tree to a shallow (one level deep)
	 * tree used by madge.
	 */
	private convertTree(depTree: NestedDependencyTree, tree: ModuleDependencyTree, pathCache: Record<string, string>): ModuleDependencyTree {
		for (const key in depTree) {
			const id = this.processPath(key, pathCache);

			if (!tree[id]) {
				tree[id] = [];

				for (const dep in depTree[key]) {
					tree[id].push(this.processPath(dep, pathCache));
				}

				this.convertTree(depTree[key], tree, pathCache);
			}
		}

		return tree;
	}

	/**
	 * Process absolute path and return a shorter one.
	 */
	private processPath(absPath: string, cache: Record<string, string>): string {
		if (cache[absPath]) {
			return cache[absPath];
		}

		let relPath = path.relative(this.baseDir, absPath);

		if (isWin) {
			relPath = relPath.replace(/\\/g, '/');
		}

		cache[absPath] = relPath;

		return relPath;
	}

	/**
	 * Check if path is from NPM folder.
	 */
	private isNpmPath(filePath: string): boolean {
		return filePath.indexOf('node_modules') >= 0;
	}

	/**
	 * Check if path is from .git folder.
	 */
	private isGitPath(filePath: string): boolean {
		return filePath.split(path.sep).indexOf('.git') !== -1;
	}

	/**
	 * Exclude modules from tree using RegExp.
	 */
	private exclude(tree: ModuleDependencyTree, excludeRegExp: string[]): ModuleDependencyTree {
		const regExpList = excludeRegExp.map((re) => new RegExp(re));

		function regExpFilter(id: string): boolean {
			return regExpList.findIndex((regexp) => regexp.test(id)) < 0;
		}

		return Object
			.keys(tree)
			.filter(regExpFilter)
			.reduce<ModuleDependencyTree>((acc, id) => {
				acc[id] = tree[id].filter(regExpFilter);
				return acc;
			}, {});
	}

	/**
	 * Sort tree.
	 */
	private sort(tree: ModuleDependencyTree): ModuleDependencyTree {
		return Object
			.keys(tree)
			.sort()
			.reduce<ModuleDependencyTree>((acc, id) => {
				acc[id] = tree[id].sort();
				return acc;
			}, {});
	}
}

function createTree(srcPaths: string[], config: TreeConfig): Promise<TreeBuildResult> {
	return new TreeBuilder(srcPaths, config).build();
}

export = createTree;
