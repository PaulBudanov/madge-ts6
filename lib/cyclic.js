'use strict';
/**
 * Get path to the circular dependency.
 */
function getPath(parent, unresolved) {
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
function resolver(id, modules, circular, resolved, unresolved) {
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
function cyclic(modules) {
    const circular = [];
    const resolved = {};
    const unresolved = {};
    Object.keys(modules).forEach((id) => {
        resolver(id, modules, circular, resolved, unresolved);
    });
    return circular;
}
module.exports = cyclic;
//# sourceMappingURL=cyclic.js.map