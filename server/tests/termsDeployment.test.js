const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');

test('backend terms service loads without access to frontend files', () => {
  const originalResolve = Module._resolveFilename;
  const servicePath = require.resolve('../services/termsService');
  delete require.cache[servicePath];
  Module._resolveFilename = function (request, ...args) {
    const resolved = originalResolve.call(this, request, ...args);
    assert.ok(!/[/\\]client[/\\]/.test(resolved), `Frontend dependency in backend: ${resolved}`);
    return resolved;
  };
  try {
    const terms = require(servicePath);
    terms.validateAgreement({ agreed: true, versions: terms.versions }, ['account']);
  } finally {
    Module._resolveFilename = originalResolve;
    delete require.cache[servicePath];
  }
});

test('frontend and backend terms manifests stay in sync', () => {
  assert.deepEqual(require('../termsVersions.json'), require('../../client/termsVersions.json'));
});
