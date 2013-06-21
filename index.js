#!/usr/bin/env node

/*
 * main js file of storra.
 * Use "node index.js" to start the server.
 */

'use strict'

var startTime = Date.now()
var log = require('./lib/log')
log.info("Starting Storra...")

var configReader = new (require('./lib/config_reader'))()
configReader.read('../storra.yml')

var StorraServer = require("./lib/server")
var server = new StorraServer()

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
  log.info('Good bye.')
}

log.info("using backend: " + global.storra_config.core.backend)

server.start(startTime)
