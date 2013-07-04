module.exports = {
  startTime: Date.now(),
  configReader: {
    create: {
      module: './config_reader',
      isConstructor: true
    },
    ready: {
      read: '../storra.yml'
    }
  },
	server: {
		create: {
      module: './server',
      isConstructor: true
    },
		properties: {
      // TODO Only inject the configuration, not the configuration
      // reader.
      configReader: { $ref: 'configReader' },
      router: { $ref: 'router' }
		},
		ready: {
      start: Date.now()
    }
	},
  router: {
    create: {
      module: './router',
      isConstructor: true
    },
    properties: {
      // TODO Only inject the configuration, not the configuration
      // reader.
      configReader: { $ref: 'configReader' },
      requesthandler: { $ref: 'requesthandler' }
    },
    ready: 'initRoutes'
  },
  requesthandler: {
    create: {
      module: './requesthandler',
      isConstructor: true
    },
    properties: {
      configReader: { $ref: 'configReader' }
    },
    ready: 'createBackend'
  }
}
