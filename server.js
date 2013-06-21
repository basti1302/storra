'use strict'

/*
 * server module - starts the http server.
 */

var http = require("http")

var log = require("./log")
var Router = require("./router")
var router = new Router()

module.exports = StorraServer

function StorraServer() {

  this.start = function(startTime) {
    function onRequest(request, response) {
      log.debug(request.method + ": " + request.url)
      router.route(request, response)
    }
    var port = global.storra_config.core.port
    var bindAddress = global.storra_config.core.bind_address

    http.createServer(onRequest).listen(port, bindAddress)

    if (startTime) {
      var rampUp = (Date.now() - startTime)
    }
    log.info("")
    log.info(" ______  ______ ______  ______  ______  ______")
    log.info("/\\  ___\\/\\__  _/\\  __ \\/\\  == \\/\\  == \\/\\  == \\")
    log.info("\\ \\___  \\/_/\\ \\\\ \\ \\_\\ \\ \\  __<\\ \\  __<\\ \\  __ \\")
    log.info(" \\/\\_____\\ \\ \\_\\\\ \\_____\\ \\_\\ \\_\\ \\_\\ \\_\\ \\_\\ \\_\\")
    log.info("  \\/_____/  \\/_/ \\/_____/\\/_/ /_/\\/_/ /_/\\/_/\\/_/")
    log.info("")
    log.info("Now listening on port " + port + ".")
    log.debug("Bind address: " + bindAddress + ".")
    if (rampUp) {
      log.info("Startup took approximately " + Math.round(rampUp/1000) + " seconds (" + rampUp + " milliseconds, to be precise).")
    }
  }

  this.shutdown = function() {
    log.debug('server: shutting down')
    router.shutdown()
  }
}

