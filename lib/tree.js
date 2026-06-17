'use strict';
const os = require("os");
const path = require("path");
const fs = require("fs");
const util_1 = require("util");
const log = require("./log");
const commondir = require('commondir');
const walk = require('walkdir');
const dependencyTree = require('dependency-tree');
const stat = (0, util_1.promisify)(fs.stat);
/**
 * Check if running on Windows.
 */
const isWin = (os.platform() === 'win32');
class TreeBuilder {
    constructor(srcPaths, config) {
        this.baseDir = '';
        this.srcPaths = srcPaths.map((srcPath) => path.resolve(srcPath));
        log('using src paths %o', this.srcPaths);
        this.config = config;
        log('using config %o', this.config);
    }
    build() {
        return this.getDirs()
            .then(this.setBaseDir.bind(this))
            .then(this.getFiles.bind(this))
            .then(this.generateTree.bind(this));
    }
    /**
     * Set the base directory (compute the common one if multiple).
     */
    setBaseDir(dirs) {
        if (this.config.baseDir) {
            this.baseDir = path.resolve(this.config.baseDir);
        }
        else {
            this.baseDir = commondir(dirs);
        }
        log('using base directory %s', this.baseDir);
    }
    /**
     * Get directories from the source paths.
     */
    getDirs() {
        return Promise
            .all(this.srcPaths.map((srcPath) => {
            return stat(srcPath)
                .then((stats) => stats.isDirectory() ? srcPath : path.dirname(path.resolve(srcPath)));
        }));
    }
    /**
     * Get all files found from the source paths.
     */
    getFiles() {
        const files = [];
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
    generateTree(files) {
        const depTree = {};
        const visited = {};
        const nonExistent = [];
        const npmPaths = {};
        const pathCache = {};
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
                    let dependencyFilterRes = true;
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
    convertTree(depTree, tree, pathCache) {
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
    processPath(absPath, cache) {
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
    isNpmPath(filePath) {
        return filePath.indexOf('node_modules') >= 0;
    }
    /**
     * Check if path is from .git folder.
     */
    isGitPath(filePath) {
        return filePath.split(path.sep).indexOf('.git') !== -1;
    }
    /**
     * Exclude modules from tree using RegExp.
     */
    exclude(tree, excludeRegExp) {
        const regExpList = excludeRegExp.map((re) => new RegExp(re));
        function regExpFilter(id) {
            return regExpList.findIndex((regexp) => regexp.test(id)) < 0;
        }
        return Object
            .keys(tree)
            .filter(regExpFilter)
            .reduce((acc, id) => {
            acc[id] = tree[id].filter(regExpFilter);
            return acc;
        }, {});
    }
    /**
     * Sort tree.
     */
    sort(tree) {
        return Object
            .keys(tree)
            .sort()
            .reduce((acc, id) => {
            acc[id] = tree[id].sort();
            return acc;
        }, {});
    }
}
function createTree(srcPaths, config) {
    return new TreeBuilder(srcPaths, config).build();
}
module.exports = createTree;
//# sourceMappingURL=tree.js.map