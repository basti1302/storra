// Very ugly duplication between lib/wire_spec.js and
// spec/integration/test_wire_spec.js
module.exports = {
  startTime: Date.now(),
  configReader: {
    create: {
      module: '../test_config_reader',
      isConstructor: true
    },
    ready: {
      mergeDefaultsIntoCurrentConfiguration: {
        core: {
          backend: './backends/node_dirty_backend'
        }
      }
    }
  },
  router: {
    create: {
      module: '../../lib/router',
      isConstructor: true
    },
    properties: {
      configReader: { $ref: 'configReader' },
      requesthandler: { $ref: 'requesthandler' }
    },
    ready: 'initRoutes'
  },
  requesthandler: {
    create: {
      module: '../../lib/requesthandler',
      isConstructor: true
    },
    properties: {
      configReader: { $ref: 'configReader' }
    },
    ready: 'createBackend'
  }
}
