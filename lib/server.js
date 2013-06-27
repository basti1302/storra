'use strict';

/*
 * server module - starts the http server.
 */

var http = require('http')

var log = require('./log')
var Router = require('./router')
var router = new Router()

function StorraServer() {

  this.start = function(startTime) {
    function onRequest(request, response) {
      log.debug(request.method + ': ' + request.url)
      router.route(request, response)
    }
    var port = global.storraConfig.core.port
    var bindAddress = global.storraConfig.core.bindAddress

    http.createServer(onRequest).listen(port, bindAddress)

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

  this.shutdown = function() {
    log.debug('server: shutting down')
    router.shutdown()
  }
}

module.exports = StorraServer
