'use strict';

import path = require('path');
import childProcess = require('child_process');
import fs = require('fs');
import {promisify} from 'util';

const gv = require('ts-graphviz') as {
	digraph: (id: string) => Graph;
	toDot: (graph: Graph) => string;
};
const adapter = require('ts-graphviz/adapter') as {
	toStream: (dot: string, options: RenderOptions) => Promise<NodeJS.ReadableStream>;
};
const toArray = require('stream-to-array') as (stream: NodeJS.ReadableStream) => Promise<Array<Buffer | Uint8Array | string>>;

const exec = promisify(childProcess.execFile);
const writeFile = promisify(fs.writeFile);

type ModuleDependencyTree = Record<string, string[]>;

interface AttributeMap {
	set: (name: string, value: unknown) => void;
}

interface GraphNode {
	attributes: AttributeMap;
}

interface Graph {
	createNode: (id: string) => GraphNode;
	createEdge: (nodes: [GraphNode, GraphNode]) => unknown;
}

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

interface RenderOptions {
	dotCommand: string | null;
	format?: string;
	attributes: {
		graph: Record<string, unknown>;
		edge: Record<string, unknown>;
		node: Record<string, unknown>;
	};
}

/**
 * Set color on a node.
 */
function setNodeColor(node: GraphNode, color: string): void {
	node.attributes.set('color', color);
	node.attributes.set('fontcolor', color);
}

/**
 * Check if Graphviz is installed on the system.
 */
async function checkGraphvizInstalled(config: GraphConfig): Promise<void> {
	const cmd = config.graphVizPath ? path.join(config.graphVizPath, 'gvpr') : 'gvpr';

	try {
		await exec(cmd, ['-V']);
	} catch (err) {
		const error = err as NodeJS.ErrnoException;

		if (error.code === 'ENOENT') {
			throw new Error(`Graphviz could not be found. Ensure that "gvpr" is in your $PATH. ${error}`);
		}

		throw new Error(`Unexpected error when calling Graphviz "${cmd}". ${error}`);
	}
}

/**
 * Return options to use with graphviz digraph.
 */
function createGraphvizOptions(config: GraphConfig): RenderOptions {
	const graphVizOptions = config.graphVizOptions || {};

	return {
		dotCommand: config.graphVizPath ? config.graphVizPath : null,
		attributes: {
			// Graph
			graph: Object.assign({
				overlap: false,
				pad: 0.3,
				rankdir: config.rankdir,
				layout: config.layout,
				bgcolor: config.backgroundColor
			}, graphVizOptions.G),
			// Edge
			edge: Object.assign({
				color: config.edgeColor
			}, graphVizOptions.E),
			// Node
			node: Object.assign({
				fontname: config.fontName,
				fontsize: config.fontSize,
				color: config.nodeColor,
				shape: config.nodeShape,
				style: config.nodeStyle,
				height: 0,
				fontcolor: config.nodeColor
			}, graphVizOptions.N)
		}
	};
}

function toBuffer(chunks: Array<Buffer | Uint8Array | string>): Buffer {
	return Buffer.concat(chunks.map((chunk) => {
		if (Buffer.isBuffer(chunk)) {
			return chunk;
		}

		return Buffer.from(chunk);
	}));
}

/**
 * Creates the graphviz graph.
 */
function createGraph(
	modules: ModuleDependencyTree,
	circular: string[][],
	config: GraphConfig,
	options: RenderOptions
): Promise<Buffer> {
	const g = gv.digraph('G');
	const nodes: Record<string, GraphNode> = {};
	const cyclicModules = circular.reduce<string[]>((a, b) => a.concat(b), []);

	Object.keys(modules).forEach((id) => {
		nodes[id] = nodes[id] || g.createNode(id);

		if (!modules[id].length) {
			setNodeColor(nodes[id], config.noDependencyColor);
		} else if (cyclicModules.indexOf(id) >= 0) {
			setNodeColor(nodes[id], config.cyclicNodeColor);
		}

		modules[id].forEach((depId) => {
			nodes[depId] = nodes[depId] || g.createNode(depId);

			if (!modules[depId]) {
				setNodeColor(nodes[depId], config.noDependencyColor);
			}

			g.createEdge([nodes[id], nodes[depId]]);
		});
	});
	const dot = gv.toDot(g);
	return adapter
		.toStream(dot, options)
		.then(toArray)
		.then(toBuffer);
}

/**
 * Return the module dependency graph XML SVG representation as a Buffer.
 */
export function svg(modules: ModuleDependencyTree, circular: string[][], config: GraphConfig): Promise<Buffer> {
	const options = createGraphvizOptions(config);

	options.format = 'svg';

	return checkGraphvizInstalled(config)
		.then(() => createGraph(modules, circular, config, options));
}

/**
 * Creates an image from the module dependency graph.
 */
export function image(modules: ModuleDependencyTree, circular: string[][], imagePath: string, config: GraphConfig): Promise<string> {
	const options = createGraphvizOptions(config);

	options.format = path.extname(imagePath).replace('.', '') || 'png';

	return checkGraphvizInstalled(config)
		.then(() => {
			return createGraph(modules, circular, config, options)
				.then((image) => writeFile(imagePath, image))
				.then(() => path.resolve(imagePath));
		});
}

/**
 * Return the module dependency graph as DOT output.
 */
export function dot(modules: ModuleDependencyTree, circular: string[][], config: GraphConfig): Promise<string> {
	const options = createGraphvizOptions(config);

	options.format = 'dot';

	return checkGraphvizInstalled(config)
		.then(() => createGraph(modules, circular, config, options))
		.then((output) => output.toString('utf8'));
}
