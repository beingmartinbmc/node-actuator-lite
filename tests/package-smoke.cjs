const assert = require('node:assert/strict');

const root = require('node-actuator-lite');
const express = require('node-actuator-lite/middleware/express');
const fastify = require('node-actuator-lite/middleware/fastify');
const deepRoot = require('node-actuator-lite/dist/index.js');
const deepExpress = require('node-actuator-lite/dist/middleware/express.js');

assert.equal(typeof root.NodeActuator, 'function');
assert.equal(typeof root.actuatorMiddleware, 'function');
assert.equal(typeof root.actuatorPlugin, 'function');
assert.equal(typeof express.actuatorMiddleware, 'function');
assert.equal(typeof fastify.actuatorPlugin, 'function');
assert.equal(typeof deepRoot.NodeActuator, 'function');
assert.equal(typeof deepExpress.actuatorMiddleware, 'function');

const actuator = new root.NodeActuator({
  serverless: true,
  env: { enabled: false },
  threadDump: { enabled: false },
  heapDump: { enabled: false },
  prometheus: { enabled: false },
});

assert.deepEqual(Object.keys(actuator.discovery()._links), [
  'self',
  'health',
  'health-component',
  'info',
  'metrics',
]);

console.log('Package smoke test passed.');
