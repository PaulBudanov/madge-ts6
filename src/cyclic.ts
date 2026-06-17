'use strict';

type ModuleDependencyTree = Record<string, string[]>;
type VisitMap = Record<string, boolean>;

/**
 * Get path to the circular dependency.
 */
function getPath(parent: string, unresolved: VisitMap): string[] {
	let parentVisited = false;

	return Object.keys(unresolved).filter((moduleId) => {
		if (moduleId === parent) {
			parentVisited = true;
		}
		return parentVisited && unresolved[moduleId];
	});
}

/**
 * A circular dependency is occurring when we see a software package
 * more than once, unless that software package has all its dependencies resolved.
 */
function resolver(
	id: string,
	modules: ModuleDependencyTree,
	circular: string[][],
	resolved: VisitMap,
	unresolved: VisitMap
): void {
	unresolved[id] = true;

	if (modules[id]) {
		modules[id].forEach((dependency) => {
			if (!resolved[dependency]) {
				if (unresolved[dependency]) {
					circular.push(getPath(dependency, unresolved));
					return;
				}
				resolver(dependency, modules, circular, resolved, unresolved);
			}
		});
	}

	resolved[id] = true;
	unresolved[id] = false;
}

/**
 * Finds all circular dependencies for the given modules.
 */
function cyclic(modules: ModuleDependencyTree): string[][] {
	const circular: string[][] = [];
	const resolved: VisitMap = {};
	const unresolved: VisitMap = {};

	Object.keys(modules).forEach((id) => {
		resolver(id, modules, circular, resolved, unresolved);
	});

	return circular;
}

export = cyclic;
