"use strict";
const path_ = require("path");
const createTree = require("./tree");
const cyclic = require("./cyclic");
const graph = require("./graph");
const log = require("./log");
const defaultConfig = {
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
function resolveConfig(config) {
    const resolved = Object.assign({}, defaultConfig, config);
    if (typeof resolved.tsConfig === "string") {
        const tsConfigPath = resolved.tsConfig;
        const ts = require("typescript");
        const tsParsedConfig = ts.readJsonConfigFile(tsConfigPath, ts.sys.readFile);
        const obj = ts.parseJsonSourceFileConfigFileContent(tsParsedConfig, ts.sys, path_.dirname(tsConfigPath));
        resolved.tsConfig = {
            ...obj.raw,
            compilerOptions: obj.options,
        };
        log("using tsconfig %o", resolved.tsConfig);
    }
    return resolved;
}
function isDependencyTree(input) {
    return typeof input === "object" && !Array.isArray(input);
}
class Madge {
    constructor(config, tree, skipped = []) {
        this.config = config;
        this.tree = tree;
        this.skipped = skipped;
    }
    static async create(input, config) {
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
    obj() {
        return this.tree;
    }
    /**
     * Return produced warnings.
     */
    warnings() {
        return {
            skipped: this.skipped,
        };
    }
    /**
     * Return the modules that has circular dependencies.
     */
    circular() {
        return cyclic(this.tree);
    }
    /**
     * Return circular dependency graph.
     */
    circularGraph() {
        const circularDeps = this.circular();
        return Object.entries(this.obj())
            .filter(([key]) => circularDeps.some((path) => path.includes(key)))
            .reduce((acc, [key, value]) => {
            acc[key] = value.filter((id) => circularDeps.some((path) => path.includes(id)));
            return acc;
        }, {});
    }
    /**
     * Return a list of modules that depends on the given module.
     */
    depends(id) {
        const tree = this.obj();
        return Object.keys(tree).filter((dep) => tree[dep].indexOf(id) >= 0);
    }
    /**
     * Return a list of modules that no one is depending on.
     */
    orphans() {
        const tree = this.obj();
        const map = {};
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
    leaves() {
        const tree = this.obj();
        return Object.keys(tree).filter((key) => !tree[key].length);
    }
    /**
     * Return the module dependency graph as DOT output.
     */
    dot(circularOnly) {
        return graph.dot(circularOnly ? this.circularGraph() : this.obj(), this.circular(), this.config);
    }
    /**
     * Write dependency graph to image.
     */
    image(imagePath, circularOnly) {
        if (!imagePath) {
            return Promise.reject(new Error("imagePath not provided"));
        }
        return graph.image(circularOnly ? this.circularGraph() : this.obj(), this.circular(), imagePath, this.config);
    }
    /**
     * Return Buffer with XML SVG representation of the dependency graph.
     */
    svg() {
        return graph.svg(this.obj(), this.circular(), this.config);
    }
}
function madge(input, config) {
    if (!input) {
        throw new Error("path argument not provided");
    }
    return Madge.create(input, config);
}
module.exports = madge;
//# sourceMappingURL=api.js.map