type ModuleDependencyTree = Record<string, string[]>;
type DependencyFilter = (dependencyFilePath: string, traversedFilePath: string, baseDir: string) => boolean | void;
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
declare function createTree(srcPaths: string[], config: TreeConfig): Promise<TreeBuildResult>;
export = createTree;
//# sourceMappingURL=tree.d.ts.map