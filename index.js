#!/usr/bin/env node

/*
 * main js file of storra.
 * Use "node index.js" to start the server.
 */

'use strict'

require('js-yaml')

var log = require('./log')

/* configuration default values */
global.storra_port = 8888
global.storra_bind_address = "0.0.0.0"
global.storra_backend = './backends/node_dirty_backend'

/* load configuration from yaml */
try {
  var config = require('./storra.yml');
  var config_keys = [
    'storra_port',
    'storra_bind_address',
    'storra_backend'
  ]
  config_keys.forEach(function(key) {
    if (config[key]) {
      global[key] = config[key]
      log.debug('from storra.yml: ' + key + ': ' + global[key])
    }
  })
} catch (e) {
  log.warn('Could not find configuration file storra.yml, will use default configuration values.')
}

var server = require("./server")

log.info("using backend: " + global.storra_backend)

server.start()
