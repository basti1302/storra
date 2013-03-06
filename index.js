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

/* register various handlers */

// TODO !!!Use domains to handle uncaught exceptions!!!!

process.on('exit', function () {
  shutdown()
})

// TODO handle more signals that are about terminating - which?
var signals = ['SIGTERM', 'SIGINT']
signals.forEach(function(signal) {
  process.on(signal, function () {
    console.log('Received signal ' + signal + ', terminating.');
    process.exit(0)
  })
})

function shutdown() {
  log.info('Storra is about to terminate.')
  server.shutdown()
  // call backend#closeConnection here....
  log.info('Good bye.')
}


var server = require("./server")

log.info("using backend: " + global.storra_backend)

server.start()
