type ModuleDependencyTree = Record<string, string[]>;
type CircularDependency = string[];
type MadgePath = string | string[];
type MadgeInput = MadgePath | ModuleDependencyTree;
type DependencyFilter = (dependencyFilePath: string, traversedFilePath: string, baseDir: string) => boolean | void;
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
declare class Madge {
    private readonly config;
    private readonly tree;
    private readonly skipped;
    private constructor();
    static create(input?: MadgeInput | null, config?: MadgeConfig): Promise<Madge>;
    /**
     * Return the module dependency graph as an object.
     */
    obj(): ModuleDependencyTree;
    /**
     * Return produced warnings.
     */
    warnings(): MadgeWarnings;
    /**
     * Return the modules that has circular dependencies.
     */
    circular(): CircularDependency[];
    /**
     * Return circular dependency graph.
     */
    circularGraph(): ModuleDependencyTree;
    /**
     * Return a list of modules that depends on the given module.
     */
    depends(id: string): string[];
    /**
     * Return a list of modules that no one is depending on.
     */
    orphans(): string[];
    /**
     * Return a list of modules that have no dependencies.
     */
    leaves(): string[];
    /**
     * Return the module dependency graph as DOT output.
     */
    dot(circularOnly?: boolean): Promise<string>;
    /**
     * Write dependency graph to image.
     */
    image(imagePath?: string | null, circularOnly?: boolean): Promise<string>;
    /**
     * Return Buffer with XML SVG representation of the dependency graph.
     */
    svg(): Promise<Buffer>;
}
declare function madge(input?: MadgeInput | null, config?: MadgeConfig): Promise<Madge>;
declare namespace madge {
    type Config = MadgeConfig;
    type DependencyTree = ModuleDependencyTree;
    type Instance = Madge;
    type Warnings = MadgeWarnings;
}
export = madge;
//# sourceMappingURL=api.d.ts.map