type ModuleDependencyTree = Record<string, string[]>;
interface GraphVizOptions {
    G?: Record<string, unknown>;
    E?: Record<string, unknown>;
    N?: Record<string, unknown>;
}
interface GraphConfig {
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
}
/**
 * Return the module dependency graph XML SVG representation as a Buffer.
 */
export declare function svg(modules: ModuleDependencyTree, circular: string[][], config: GraphConfig): Promise<Buffer>;
/**
 * Creates an image from the module dependency graph.
 */
export declare function image(modules: ModuleDependencyTree, circular: string[][], imagePath: string, config: GraphConfig): Promise<string>;
/**
 * Return the module dependency graph as DOT output.
 */
export declare function dot(modules: ModuleDependencyTree, circular: string[][], config: GraphConfig): Promise<string>;
export {};
//# sourceMappingURL=graph.d.ts.map