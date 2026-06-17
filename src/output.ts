'use strict';

const chalk = require('chalk') as any;
const pluralize = require('pluralize') as (word: string, count?: number, inclusive?: boolean) => string;
const prettyMs = require('pretty-ms') as (milliseconds: number) => string;

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
 * Print given object as JSON.
 */
function printJSON(obj: unknown): void {
	console.log(JSON.stringify(obj, null, '  '));
}

/**
 * Print module dependency graph as indented text (or JSON).
 */
export function list(modules: ModuleDependencyTree, opts?: OutputOptions): void {
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
export function summary(modules: ModuleDependencyTree, opts?: OutputOptions): void {
	const o: Record<string, number> = {};

	opts = opts || {};

	Object.keys(modules).sort((a, b) => {
		return modules[b].length - modules[a].length;
	}).forEach((id) => {
		if (opts.json) {
			o[id] = modules[id].length;
		} else {
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
export function circular(spinner: Spinner, res: unknown, circularDeps: string[][], opts: CircularOutputOptions): void {
	if (opts.json) {
		return printJSON(circularDeps);
	}

	const cyclicCount = Object.keys(circularDeps).length;

	if (!circularDeps.length) {
		spinner.succeed(chalk.bold('No circular dependency found!'));
	} else {
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
export function modules(modules: string[], opts: OutputOptions): void {
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
export function warnings(res: MadgeLike): void {
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
export function getResultSummary(res: MadgeLike, startTime: number): void {
	const warningCount = res.warnings().skipped.length;
	const fileCount = Object.keys(res.obj()).length;

	console.log('Processed %s %s %s %s\n',
		chalk.bold(fileCount),
		pluralize('file', fileCount),
		chalk.dim(`(${prettyMs(Date.now() - startTime)})`),
		warningCount ? '(' + chalk.yellow.bold(pluralize('warning', warningCount, true)) + ')' : ''
	);
}
