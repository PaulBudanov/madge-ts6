'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.svg = svg;
exports.image = image;
exports.dot = dot;
const path = require("path");
const childProcess = require("child_process");
const fs = require("fs");
const util_1 = require("util");
const gv = require('ts-graphviz');
const adapter = require('ts-graphviz/adapter');
const toArray = require('stream-to-array');
const exec = (0, util_1.promisify)(childProcess.execFile);
const writeFile = (0, util_1.promisify)(fs.writeFile);
/**
 * Set color on a node.
 */
function setNodeColor(node, color) {
    node.attributes.set('color', color);
    node.attributes.set('fontcolor', color);
}
/**
 * Check if Graphviz is installed on the system.
 */
async function checkGraphvizInstalled(config) {
    const cmd = config.graphVizPath ? path.join(config.graphVizPath, 'gvpr') : 'gvpr';
    try {
        await exec(cmd, ['-V']);
    }
    catch (err) {
        const error = err;
        if (error.code === 'ENOENT') {
            throw new Error(`Graphviz could not be found. Ensure that "gvpr" is in your $PATH. ${error}`);
        }
        throw new Error(`Unexpected error when calling Graphviz "${cmd}". ${error}`);
    }
}
/**
 * Return options to use with graphviz digraph.
 */
function createGraphvizOptions(config) {
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
function toBuffer(chunks) {
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
function createGraph(modules, circular, config, options) {
    const g = gv.digraph('G');
    const nodes = {};
    const cyclicModules = circular.reduce((a, b) => a.concat(b), []);
    Object.keys(modules).forEach((id) => {
        nodes[id] = nodes[id] || g.createNode(id);
        if (!modules[id].length) {
            setNodeColor(nodes[id], config.noDependencyColor);
        }
        else if (cyclicModules.indexOf(id) >= 0) {
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
function svg(modules, circular, config) {
    const options = createGraphvizOptions(config);
    options.format = 'svg';
    return checkGraphvizInstalled(config)
        .then(() => createGraph(modules, circular, config, options));
}
/**
 * Creates an image from the module dependency graph.
 */
function image(modules, circular, imagePath, config) {
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
function dot(modules, circular, config) {
    const options = createGraphvizOptions(config);
    options.format = 'dot';
    return checkGraphvizInstalled(config)
        .then(() => createGraph(modules, circular, config, options))
        .then((output) => output.toString('utf8'));
}
//# sourceMappingURL=graph.js.map