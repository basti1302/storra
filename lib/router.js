'use strict';

/*
 * request routing:
 * - parses request url and method
 * - delegates to the appropriate request handler
 */

var url = require('url')

var log = require('./log')

function Router() {

  var self = this

  var resourceRoutes

  this.initRoutes = function() {
    /* configure resources and their supported methods here: */
    resourceRoutes = {
      root: {
        OPTIONS: this.requesthandler.options,
        GET: this.requesthandler.root
        // A POST to / would create a collection, but currently, collections are
        // created on the fly when first mentioned
        // POST: this.requesthandler.createCollection
      },
      collection: {
        OPTIONS: this.requesthandler.options,
        GET: this.requesthandler.list,
        POST: this.requesthandler.create,
        DELETE: this.requesthandler.removeCollection
      },
      document: {
        OPTIONS: this.requesthandler.options,
        GET: this.requesthandler.retrieve,
        PUT: this.requesthandler.update,
        DELETE: this.requesthandler.remove
      }
    }
  }

  this.route = function (request, response) {
    log.debug('routing: %s: %s', request.method, request.url)
    parsePath(request, response, function(collection, key) {
      var resource
      if (collection === undefined) {
        log.debug('routing to /')
        resource = resourceRoutes.root
      } else if (key === undefined) {
        if (collection === 'favicon.ico') {
          // reject requests to /favicon.ico
          log.debug('rejecting request for /favicon.ico with 404')
          return this.requesthandler.notFound(response)
        }
        log.debug('routing to /%s', collection)
        resource = resourceRoutes.collection
      } else {
        log.debug('routing to /%s/%s', collection, key)
        resource = resourceRoutes.document
      }
      var handler = resource[request.method]
      if (handler === undefined) {
        log.debug('no handler for request, responding 500 Not Implemented')
        return this.requesthandler.notImplemented(response)
      } else {
        return handler(request, response, collection, key)
      }
    })
  }

  this.shutdown = function() {
    log.debug('router: shutting down')
    this.requesthandler.shutdown()
  }

  // this might be too simplistic - we assume that there are at most two path
  // parameters and they are hardcoded to be collection and key. However,
  // currently we don't need more, it seems.
  function parsePath(request, response, routeToResource) {
    var path = url.parse(request.url).pathname
    var parts = path.split('/').filter(function(part) {
      return !!part
    })
    var collection
    var key
    if (parts.length === 1) {
      collection = parts[0]
    }
    else if (parts.length >= 2) {
      key = parts[1]
      collection = parts[0]
      if (parts.length > 2) {
        self.requesthandler.notFound(response, 'Currently, only paths of the ' +
            'form /collection or /collection/key are supported. The path [' +
            path + '] contained more than two parts.')
        return
      }
    }
    routeToResource(collection, key)
  }
}

module.exports = Router
