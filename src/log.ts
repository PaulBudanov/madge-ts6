'use strict';

const createDebug = require('debug') as (namespace: string) => (formatter: unknown, ...args: unknown[]) => void;

export = createDebug('madge');
