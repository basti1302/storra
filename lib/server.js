'use strict';

/*
 * server module - starts the http server.
 */

var http = require('http')

var configReader = new (require('./config_reader'))()
var log = require('./log')
var Router = require('./router')
var router

function StorraServer() {

  var port
  var bindAddress

  this.start = function(startTime) {
    if (!startTime) {
      startTime = Date.now()
    }
    readConfig()
    registerHandlers()
    router = new Router()
    createServer()
    printWelcomeMessage(startTime)
  }

  function readConfig() {
    log.info('Starting Storra...')
    configReader.read('../storra.yml')
    log.info('using backend: ' + global.storraConfig.core.backend)
  }

  function registerHandlers() {

    // TODO !!!Use domains to handle uncaught exceptions!!!!
    function shutdown() {
      log.info('Storra is about to terminate.')
      log.debug('server: shutting down')
      router.shutdown()
      log.info('Good bye.')
    }

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
  }

  function createServer() {
    function onRequest(request, response) {
      log.debug(request.method + ': ' + request.url)
      router.route(request, response)
    }
    port = global.storraConfig.core.port
    bindAddress = global.storraConfig.core.bindAddress
    http.createServer(onRequest).listen(port, bindAddress)
  }

  function printWelcomeMessage(startTime) {
    var rampUp
    if (startTime) {
      rampUp = (Date.now() - startTime)
    }
    /* jshint -W101 */
    log.info('')
    log.info(' ______  ______ ______  ______  ______  ______')
    log.info('/\\  ___\\/\\__  _/\\  __ \\/\\  == \\/\\  == \\/\\  == \\')
    log.info('\\ \\___  \\/_/\\ \\\\ \\ \\_\\ \\ \\  __<\\ \\  __<\\ \\  __ \\')
    log.info(' \\/\\_____\\ \\ \\_\\\\ \\_____\\ \\_\\ \\_\\ \\_\\ \\_\\ \\_\\ \\_\\')
    log.info('  \\/_____/  \\/_/ \\/_____/\\/_/ /_/\\/_/ /_/\\/_/\\/_/')
    log.info('')
    /* jshint +W101 */
    log.info('Now listening on port ' + port + '.')
    log.debug('Bind address: ' + bindAddress + '.')
    if (rampUp) {
      log.info('Startup took approximately ' + Math.round(rampUp/1000) +
          ' seconds (' + rampUp + ' milliseconds, to be precise).')
    }
  }
}

module.exports = StorraServer
