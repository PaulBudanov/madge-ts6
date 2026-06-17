type ModuleDependencyTree = Record<string, string[]>;
interface OutputOptions {
    json?: boolean;
}
interface CircularOutputOptions extends OutputOptions {
    printCount?: boolean;
}
interface Spinner {
    succeed: (message?: string) => unknown;
    fail: (message?: string) => unknown;
}
interface MadgeLike {
    obj: () => ModuleDependencyTree;
    warnings: () => {
        skipped: string[];
    };
}
/**
 * Print module dependency graph as indented text (or JSON).
 */
export declare function list(modules: ModuleDependencyTree, opts?: OutputOptions): void;
/**
 * Print a summary of module dependencies.
 */
export declare function summary(modules: ModuleDependencyTree, opts?: OutputOptions): void;
/**
 * Print the result from Madge.circular().
 */
export declare function circular(spinner: Spinner, res: unknown, circularDeps: string[][], opts: CircularOutputOptions): void;
/**
 * Print the given modules.
 */
export declare function modules(modules: string[], opts: OutputOptions): void;
/**
 * Print warnings to the console.
 */
export declare function warnings(res: MadgeLike): void;
/**
 * Get a summary from the result.
 */
export declare function getResultSummary(res: MadgeLike, startTime: number): void;
export {};
//# sourceMappingURL=output.d.ts.map