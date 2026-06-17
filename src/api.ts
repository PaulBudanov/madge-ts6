"use strict";

import path_ = require("path");
import createTree = require("./tree");
import cyclic = require("./cyclic");
import graph = require("./graph");
import log = require("./log");

type ModuleDependencyTree = Record<string, string[]>;
type CircularDependency = string[];
type MadgePath = string | string[];
type MadgeInput = MadgePath | ModuleDependencyTree;
type DependencyFilter = (
	dependencyFilePath: string,
	traversedFilePath: string,
	baseDir: string,
) => boolean | void;

interface MadgeWarnings {
	skipped: string[];
}

interface GraphVizOptions {
	G?: Record<string, unknown>;
	E?: Record<string, unknown>;
	N?: Record<string, unknown>;
}

interface MadgeConfig {
	baseDir?: string | null;
	excludeRegExp?: string[] | false;
	fileExtensions?: string[];
	includeNpm?: boolean;
	requireConfig?: unknown;
	webpackConfig?: unknown;
	tsConfig?: string | Record<string, unknown> | null;
	rankdir?: string;
	layout?: string;
	fontName?: string;
	fontSize?: string;
	backgroundColor?: string;
	nodeColor?: string;
	nodeShape?: string;
	nodeStyle?: string;
	noDependencyColor?: string;
	cyclicNodeColor?: string;
	edgeColor?: string;
	graphVizOptions?: GraphVizOptions | false;
	graphVizPath?: string | false;
	dependencyFilter?: DependencyFilter | false;
	detectiveOptions?: unknown;
	[key: string]: unknown;
}

interface ResolvedMadgeConfig extends MadgeConfig {
	baseDir: string | null;
	excludeRegExp: string[] | false;
	fileExtensions: string[];
	includeNpm: boolean;
	requireConfig: unknown;
	webpackConfig: unknown;
	tsConfig: string | Record<string, unknown> | null;
	rankdir: string;
	layout: string;
	fontName: string;
	fontSize: string;
	backgroundColor: string;
	nodeColor: string;
	nodeShape: string;
	nodeStyle: string;
	noDependencyColor: string;
	cyclicNodeColor: string;
	edgeColor: string;
	graphVizOptions: GraphVizOptions | false;
	graphVizPath: string | false;
	dependencyFilter: DependencyFilter | false;
}

const defaultConfig: ResolvedMadgeConfig = {
	baseDir: null,
	excludeRegExp: false,
	fileExtensions: ["js"],
	includeNpm: false,
	requireConfig: null,
	webpackConfig: null,
	tsConfig: null,
	rankdir: "LR",
	layout: "dot",
	fontName: "Arial",
	fontSize: "14px",
	backgroundColor: "#111111",
	nodeColor: "#c6c5fe",
	nodeShape: "box",
	nodeStyle: "rounded",
	noDependencyColor: "#cfffac",
	cyclicNodeColor: "#ff6c60",
	edgeColor: "#757575",
	graphVizOptions: false,
	graphVizPath: false,
	dependencyFilter: false,
};

function resolveConfig(config?: MadgeConfig): ResolvedMadgeConfig {
	const resolved = Object.assign({}, defaultConfig, config);

	if (typeof resolved.tsConfig === "string") {
		const tsConfigPath = resolved.tsConfig;
		const ts = require("typescript") as typeof import("typescript");
		const tsParsedConfig = ts.readJsonConfigFile(tsConfigPath, ts.sys.readFile);
		const obj = ts.parseJsonSourceFileConfigFileContent(
			tsParsedConfig,
			ts.sys,
			path_.dirname(tsConfigPath),
		);

		resolved.tsConfig = {
			...obj.raw,
			compilerOptions: obj.options,
		};
		log("using tsconfig %o", resolved.tsConfig);
	}

	return resolved;
}

function isDependencyTree(input: MadgeInput): input is ModuleDependencyTree {
	return typeof input === "object" && !Array.isArray(input);
}

class Madge {
	private readonly config: ResolvedMadgeConfig;
	private readonly tree: ModuleDependencyTree;
	private readonly skipped: string[];

	private constructor(
		config: ResolvedMadgeConfig,
		tree: ModuleDependencyTree,
		skipped: string[] = [],
	) {
		this.config = config;
		this.tree = tree;
		this.skipped = skipped;
	}

	static async create(
		input?: MadgeInput | null,
		config?: MadgeConfig,
	): Promise<Madge> {
		if (!input) {
			throw new Error("path argument not provided");
		}

		const resolvedConfig = resolveConfig(config);

		if (isDependencyTree(input)) {
			log("using predefined tree %o", input);
			return new Madge(resolvedConfig, input);
		}

		const srcPaths = typeof input === "string" ? [input] : input;
		const res = await createTree(srcPaths, resolvedConfig);

		return new Madge(resolvedConfig, res.tree, res.skipped);
	}

	/**
	 * Return the module dependency graph as an object.
	 */
	obj(): ModuleDependencyTree {
		return this.tree;
	}

	/**
	 * Return produced warnings.
	 */
	warnings(): MadgeWarnings {
		return {
			skipped: this.skipped,
		};
	}

	/**
	 * Return the modules that has circular dependencies.
	 */
	circular(): CircularDependency[] {
		return cyclic(this.tree);
	}

	/**
	 * Return circular dependency graph.
	 */
	circularGraph(): ModuleDependencyTree {
		const circularDeps = this.circular();

		return Object.entries(this.obj())
			.filter(([key]) => circularDeps.some((path) => path.includes(key)))
			.reduce<ModuleDependencyTree>((acc, [key, value]) => {
				acc[key] = value.filter((id) =>
					circularDeps.some((path) => path.includes(id)),
				);
				return acc;
			}, {});
	}

	/**
	 * Return a list of modules that depends on the given module.
	 */
	depends(id: string): string[] {
		const tree = this.obj();

		return Object.keys(tree).filter((dep) => tree[dep].indexOf(id) >= 0);
	}

	/**
	 * Return a list of modules that no one is depending on.
	 */
	orphans(): string[] {
		const tree = this.obj();
		const map: Record<string, boolean> = {};

		Object.keys(tree).forEach((dep) => {
			tree[dep].forEach((id) => {
				map[id] = true;
			});
		});

		return Object.keys(tree).filter((dep) => !map[dep]);
	}

	/**
	 * Return a list of modules that have no dependencies.
	 */
	leaves(): string[] {
		const tree = this.obj();
		return Object.keys(tree).filter((key) => !tree[key].length);
	}

	/**
	 * Return the module dependency graph as DOT output.
	 */
	dot(circularOnly?: boolean): Promise<string> {
		return graph.dot(
			circularOnly ? this.circularGraph() : this.obj(),
			this.circular(),
			this.config,
		);
	}

	/**
	 * Write dependency graph to image.
	 */
	image(imagePath?: string | null, circularOnly?: boolean): Promise<string> {
		if (!imagePath) {
			return Promise.reject(new Error("imagePath not provided"));
		}

		return graph.image(
			circularOnly ? this.circularGraph() : this.obj(),
			this.circular(),
			imagePath,
			this.config,
		);
	}

	/**
	 * Return Buffer with XML SVG representation of the dependency graph.
	 */
	svg(): Promise<Buffer> {
		return graph.svg(this.obj(), this.circular(), this.config);
	}
}

function madge(
	input?: MadgeInput | null,
	config?: MadgeConfig,
): Promise<Madge> {
	if (!input) {
		throw new Error("path argument not provided");
	}

	return Madge.create(input, config);
}

namespace madge {
	export type Config = MadgeConfig;
	export type DependencyTree = ModuleDependencyTree;
	export type Instance = Madge;
	export type Warnings = MadgeWarnings;
}

export = madge;
