'use strict';

/*
 * server module - starts the http server.
 */
var http = require('http')

var log = require('./log')

function StorraServer() {

  var self = this

  var port
  var bindAddress

  this.start = function(startTime) {
    startTime = figureOutStartTime(startTime)
    registerHandlers()
    createServer()
    printWelcomeMessage(startTime)
  }

  function figureOutStartTime(startTime) {
    // If a startTime was given as a parameter to this.start(startTime), use it:
    if (startTime) {
      return startTime
    } else {
      // otherwise set the start time (slightly incorrect) to now.
      return Date.now()
    }
  }

  function registerHandlers() {

    // TODO !!!Use domains to handle uncaught exceptions!!!!
    function shutdown() {
      log.info('Storra is about to terminate.')
      log.debug('server: shutting down')
      self.router.shutdown()
      log.info('Good bye.')
    }

    process.once('exit', function () {
      shutdown()
    })

    // TODO handle more signals that are about terminating - which?
    var signals = ['SIGTERM', 'SIGINT']
    signals.forEach(function(signal) {
      process.on(signal, function () {
        console.log('Received signal %s, terminating.', signal);
        process.exit(0)
      })
    })
  }

  function createServer() {
    function onRequest(request, response) {
      log.debug('%s: %s', request.method, request.url)
      self.router.route(request, response)
    }
    port = self.configReader.configuration.core.port
    bindAddress = self.configReader.configuration.core.bindAddress
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
    log.info('Now listening on port %d.', port)
    log.debug('Bind address: %s', bindAddress)
    if (rampUp) {
      log.info('Startup took approximately %d seconds (%d milliseconds, to ' +
            'be precise).', Math.round(rampUp/1000), rampUp)
    }
  }
}

module.exports = StorraServer
