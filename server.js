'use strict'

/*
 * server module - starts the http server.
 */

var http = require("http")

var log = require("./log")
var router = require("./router")

exports.start = function() {
  function onRequest(request, response) {
    log.debug(request.method + ": " + request.url)
    router.route(request, response)
  }
  var port = global.storra_configuration.core.port
  var bindAddress = global.storra_configuration.core.bind_address

  http.createServer(onRequest).listen(port, bindAddress)
  log.info("Storra is now listening on port " + port + " (bind address: " + bindAddress + ")" + "...")
}

exports.shutdown = function() {
  log.debug('server: shutting down')
  router.shutdown()
}
