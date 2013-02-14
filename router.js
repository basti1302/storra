'use strict'

/*
 * request routing:
 * - parses request url and method
 * - delegates to the appropriate request handler
 */

var url = require("url")

var log = require("./log")
var requesthandler = require("./requesthandler")

/* configure resources and their supported methods here: */
var resourceRoutes = {
  root: {
    OPTIONS: requesthandler.options,
    GET: requesthandler.root
    // currently, collections are created on the fly when first mentioned
    // POST: requesthandler.createCollection
  },
  collection: {
    OPTIONS: requesthandler.options,
    GET: requesthandler.list,
    POST: requesthandler.create,
    DELETE: requesthandler.removeCollection
  },
  document: {
    OPTIONS: requesthandler.options,
    GET: requesthandler.retrieve,
    PUT: requesthandler.update,
    DELETE: requesthandler.remove
  }
}

exports.route = function route(request, response) {
  parsePath(request, function(collection, key) {
    var resource
    if (collection === undefined) {
      resource = resourceRoutes.root
    } else if (key === undefined) {
      if (collection === 'favicon.ico') {
        // reject requests to /favicon.ico
        requesthandler.notFound(response)
        return
      }
      resource = resourceRoutes.collection
    } else {
      resource = resourceRoutes.document
    }
    var handler = resource[request.method]
    if (handler === undefined) {
      requesthandler.notImplemented(response)
    } else {
      handler(request, response, collection, key)
    }
  })
}

// this might be too simplistic - we assume that there are at most two path
// parameters and they are hardcoded to be collection and key. However,
// currently we don't need more, it seems.
function parsePath(request, routeToResource) {
  var path = url.parse(request.url).pathname
  var parts = path.split('/').filter(function(part) {
    return !!part
  })
  var collection
  var key
  if (parts.length == 1) {
    collection = parts[0]
  }      
  else if (parts.length >= 2) {
    key = parts[1]
    collection = parts[0]
    if (parts.length > 2) {
      log.warn("Currently, only paths of the form /collection or /collection/key are supported. The path [" + path + "] contained more than two parts. All except collection (" + collection + ") and key (" + key + ") will be ignored.")
    }
  }
  routeToResource(collection, key)
}
