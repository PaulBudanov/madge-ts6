'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.summary = summary;
exports.circular = circular;
exports.modules = modules;
exports.warnings = warnings;
exports.getResultSummary = getResultSummary;
const chalk = require('chalk');
const pluralize = require('pluralize');
const prettyMs = require('pretty-ms');
/**
 * Print given object as JSON.
 */
function printJSON(obj) {
    console.log(JSON.stringify(obj, null, '  '));
}
/**
 * Print module dependency graph as indented text (or JSON).
 */
function list(modules, opts) {
    opts = opts || {};
    if (opts.json) {
        return printJSON(modules);
    }
    Object.keys(modules).forEach((id) => {
        console.log(chalk.cyan.bold(id));
        modules[id].forEach((depId) => {
            console.log(chalk.grey(`  ${depId}`));
        });
    });
}
/**
 * Print a summary of module dependencies.
 */
function summary(modules, opts) {
    const o = {};
    opts = opts || {};
    Object.keys(modules).sort((a, b) => {
        return modules[b].length - modules[a].length;
    }).forEach((id) => {
        if (opts.json) {
            o[id] = modules[id].length;
        }
        else {
            console.log('%s %s', chalk.cyan.bold(modules[id].length), chalk.grey(id));
        }
    });
    if (opts.json) {
        return printJSON(o);
    }
}
/**
 * Print the result from Madge.circular().
 */
function circular(spinner, res, circularDeps, opts) {
    if (opts.json) {
        return printJSON(circularDeps);
    }
    const cyclicCount = Object.keys(circularDeps).length;
    if (!circularDeps.length) {
        spinner.succeed(chalk.bold('No circular dependency found!'));
    }
    else {
        spinner.fail(chalk.red.bold(`Found ${pluralize('circular dependency', cyclicCount, true)}!\n`));
        circularDeps.forEach((dependencyPath, idx) => {
            if (opts.printCount) {
                process.stdout.write(chalk.dim(idx + 1 + ') '));
            }
            dependencyPath.forEach((moduleId, pathIdx) => {
                if (pathIdx) {
                    process.stdout.write(chalk.dim(' > '));
                }
                process.stdout.write(chalk.cyan.bold(moduleId));
            });
            process.stdout.write('\n');
        });
    }
}
/**
 * Print the given modules.
 */
function modules(modules, opts) {
    if (opts.json) {
        return printJSON(modules);
    }
    modules.forEach((id) => {
        console.log(chalk.cyan.bold(id));
    });
}
/**
 * Print warnings to the console.
 */
function warnings(res) {
    const skipped = res.warnings().skipped;
    if (skipped.length) {
        console.log(chalk.yellow.bold(`\n✖ Skipped ${pluralize('file', skipped.length, true)}\n`));
        skipped.forEach((file) => {
            console.log(chalk.yellow(file));
        });
    }
}
/**
 * Get a summary from the result.
 */
function getResultSummary(res, startTime) {
    const warningCount = res.warnings().skipped.length;
    const fileCount = Object.keys(res.obj()).length;
    console.log('Processed %s %s %s %s\n', chalk.bold(fileCount), pluralize('file', fileCount), chalk.dim(`(${prettyMs(Date.now() - startTime)})`), warningCount ? '(' + chalk.yellow.bold(pluralize('warning', warningCount, true)) + ')' : '');
}
//# sourceMappingURL=output.js.map