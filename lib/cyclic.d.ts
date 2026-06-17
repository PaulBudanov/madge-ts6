type ModuleDependencyTree = Record<string, string[]>;
/**
 * Finds all circular dependencies for the given modules.
 */
declare function cyclic(modules: ModuleDependencyTree): string[][];
export = cyclic;
//# sourceMappingURL=cyclic.d.ts.map