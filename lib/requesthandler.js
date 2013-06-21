'use strict'

/*
 * request handler:
 * - reads request body data (for POST and PUT)
 * - executes the requested backend action
 * - writes the response
 * - has methods for writing http error responses (4xx, 5xx)
 */

var url = require("url")

var log = require("./log")
var BackendConnector = require(global.storra_config.core.backend)
var backend = new BackendConnector()

module.exports = RequestHandler

function RequestHandler() {

  var self = this

  function endsWith(string, suffix) {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
  }

  function merge(target, source) {
    if (!target) {
      target = {}
    }
    if (!source) {
      return target
    }
    for (var attr in source) {
      target[attr] = source[attr]
    }
    return target
  }

  function fullUrl(request)
  {
    var protocol = 'http'
    if (request.headers && request.headers['x-forwarded-protocol'] == 'https') {
      protocol = 'https'
    }
    var host = request.headers.host
    var portInUrl
    if (host.indexOf(':' >= 0)) {
      portInUrl = ''
    } else {
      var port = global.storra_config.core.port
      portInUrl = (protocol == 'http' && port == 80) || (protocol == 'https' && port == 443) ? '' : ':' + port
    }
    var fullUrl = protocol + '://' + host + portInUrl + url.parse(request.url).path
    if (!endsWith(fullUrl, '/')) { fullUrl += '/' }
    return fullUrl
  }


  function writeHeader(response, status, additionalHeaders) {
    response.writeHead(status, merge({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "X-Requested-With, Access-Control-Allow-Origin, X-HTTP-Method-Override, Content-Type, Authorization, Accept",
      "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Credentials": true,
      "Access-Control-Max-Age": '86400' // 24 hours
    }, additionalHeaders))
  }

  function writeNoContentHeader(response, status, additionalHeaders) {
    writeHeader(response, status, additionalHeaders)
  }

  function writeContentHeader(response, status, contentType, additionalHeaders) {
    writeHeader(response, status, merge({ "Content-Type": contentType }, additionalHeaders))
  }

  function writePlainTextHeader(response, status, additionalHeaders) {
    writeContentHeader(response, status, "text/plain", additionalHeaders)
  }

  function writeJsonHeader(response, status, additionalHeaders) {
    writeContentHeader(response, status, "application/json;charset=UTF-8", additionalHeaders)
  }

  // GET /
  this.root = function(request, response) {
    writePlainTextHeader(response, 400)
    response.write("This is storra, the REST data store. Usage:\n")
    response.write("GET / to display this text,\n")
    response.write("GET /collection to list a collection of documents,\n")
    response.write("POST to /collection to create a new document (the new key is returned in the \"Location\" header),\n")
    response.write("GET /collection/key to retrieve a document,\n")
    response.write("PUT /collection/key to update a document or\n")
    response.write("DELETE /collection/key to delete a document.\n")
    response.end()
  }

  // OPTIONS *
  this.options = function(request, response) {
    writeNoContentHeader(response, 200)
    response.end();
    log.debug("responded to OPTIONS request")
  }

  // GET /collection
  this.list = function(request, response, collection) {
    var first = true
    backend.list(collection, function(document) {
      if (first) {
        // That's ugly - we write the 200 header when the first documents have been
        // read from the backend. If a error happens later, we can not change that
        // to 500 anymore.
        writeStartForList(response)
        writeDoc(response, document)
        first = false
      } else {
        response.write(',')
        writeDoc(response, document)
      }
    }, function(err) {
      if (err) {
        log.error(err)
        if (first) {
          self.internalServerError(response)
        }
        // if we already have written http status 200 to the response
        // it's too late to say 500 now.
        response.end(response)
      } else {
        if (first) {
          writeStartForList(response)
        }
        response.write(']')
        response.end()
        log.debug("successfully listed " + collection)
      }
    })
  }

  function writeStartForList(response) {
    writeJsonHeader(response, 200)
    response.write('[')
  }

  function writeDoc(response, document) {
    response.write(JSON.stringify(document))
  }

  // DELETE /collection
  this.removeCollection = function(request, response, collection) {
    backend.removeCollection(collection, function(err) {
      if (err) {
        log.error(err.stack)
        self.internalServerError(response)
      } else {
        writeNoContentHeader(response, 204)
        response.end()
        log.debug("successfully removed collection " + collection)
      }
    })
  }

  // GET /collection/key
  this.retrieve = function(request, response, collection, key) {
    backend.read(collection, key, function(err, document, key) {
      if (err && err.http_status && err.http_status === 404) {
        self.notFound(response)
      } else if (err) {
        log.error(err.stack)
        self.internalServerError(response)
      } else {
        writeJsonHeader(response, 200)
        response.write(JSON.stringify(document))
        response.end()
        log.debug("successfully read " + collection + "/" + key)
      }
    })
  }

  // POST /collection
  this.create = function(request, response, collection) {
    createOrUpdate(request, response, function(bodyObject) {
      backend.create(collection, bodyObject, function(err, key) {
        if (err) {
          log.error('Error in backend.create: ' + err)
          self.internalServerError(response)
        } else {
          writeNoContentHeader(response, 201, {"Location": fullUrl(request) + key})
          response.end()
          log.debug("successfully inserted entry into " + collection + " -> " + key)
        }
      })
    })
  }

  // PUT /collection/key
  this.update = function(request, response, collection, key) {
    createOrUpdate(request, response, function(bodyObject) {
      backend.update(collection, key, bodyObject, function(err) {
        if (err) {
          if (err.http_status && err.http_status === 404) {
            self.notFound(response)
          } else {
            log.error(err)
            self.internalServerError(response)
          }
        } else {
          writeNoContentHeader(response, 204)
          response.end()
          log.debug("successfully updated " + collection + "/" + key)
        }
      })
    })
  }

  function createOrUpdate(request, response, upsert) {
    var body = ""
    request.on('data', function(chunk) {
      body += chunk.toString()
    })
    request.on('end', function() {
      var bodyObject
      try {
        /* (too chatty, even for debug) log.debug("Received body: " + body) */
        bodyObject = JSON.parse(body)
      } catch (err) {
        log.error(err)
        self.badRequest(response, "Check the body of your request. Is it valid JSON?")
        return
      }
      upsert(bodyObject)
    })
  }

  // DELETE /collection/key
  this.remove = function(request, response, collection, key) {
    backend.remove(collection, key, function(err) {
      if (err) {
        log.error(err.stack)
        self.internalServerError(response)
      } else {
        writeNoContentHeader(response, 204)
        response.end()
        log.debug("successfully removed " + collection + "/" + key)
      }
    })
  }


  // 400
  this.badRequest = function(response, info) {
    log.info("400 Bad Request")
    writePlainTextHeader(response, 400)
    response.write("I'm unable to process this request. I'm terribly sorry.")
    if (info) {
      response.write("\nAdditional info: " + info)
    }
    response.end()
  }

  // 404
  this.notFound = function notFound(response, additionalInfo) {
    log.info("404 Not Found")
    writePlainTextHeader(response, 404)
    response.write("The requested resource was not found. ")
    if (additionalInfo) {
      response.write(additionalInfo)
    }
    response.end()
  }

  // 500
  this.internalServerError = function internalServerError(response) {
    log.info("500 Internal Server Error")
    writePlainTextHeader(response, 500)
    response.write("Oops, something went wrong.")
    response.end()
  }

  // 501
  this.notImplemented = function(response) {
    log.info("501 Not Implemented")
    writeNoContentHeader(response, 501)
    response.end()
  }

  this.shutdown = function() {
    log.debug('requesthandler: shutting down')
    backend.closeConnection(function(err) {
      if (err) {
        log.error('An error occured when closing the database connection.')
        log.error(err)
        log.error(err.stack)
      } else {
        log.debug('Database connections have been closed.')
      }
    })
  }
}
