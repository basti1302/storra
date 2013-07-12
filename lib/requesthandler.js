'use strict';

/*
 * request handler:
 * - reads request body data (for POST and PUT)
 * - executes the requested backend action
 * - writes the response
 * - has methods for writing http error responses (4xx, 5xx)
 */

var url = require('url')

var log = require('./log')

function RequestHandler() {

  var self = this

  this.backend = null

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
      if (source.hasOwnProperty(attr)) {
        target[attr] = source[attr]
      }
    }
    return target
  }

  function fullUrl(request) {
    var protocol = 'http'
    if (request.headers &&
        request.headers['x-forwarded-protocol'] === 'https') {
      protocol = 'https'
    }
    var host = request.headers.host
    var portInUrl
    if (host.indexOf(':' >= 0)) {
      portInUrl = ''
    } else {
      var port = global.storraConfig.core.port
      if (protocol === 'http' && port === 80) {
        portInUrl = ''
      } else if (protocol === 'https' && port === 443) {
        portInUrl = ''
      } else {
        portInUrl = port
      }
    }
    var theUrl = protocol + '://' + host + portInUrl +
        url.parse(request.url).path
    if (!endsWith(theUrl, '/')) {
      theUrl += '/'
    }
    return theUrl
  }


  function writeHeader(response, httpStatus, additionalHeaders) {
    response.writeHead(httpStatus, merge({
      'access-control-allow-origin': '*',
      'access-control-allow-headers':
          'X-Requested-With, Access-Control-Allow-Origin, ' +
          'X-HTTP-Method-Override, Content-Type, Authorization, Accept',
      'access-control-allow-methods': 'POST, GET, PUT, DELETE, OPTIONS',
      'access-control-allow-credentials': true,
      'access-control-max-age': '86400' // 24 hours
    }, additionalHeaders))
  }

  function writeNoContentHeader(response, httpStatus, additionalHeaders) {
    writeHeader(response, httpStatus, additionalHeaders)
  }

  function writeContentHeader(response, httpStatus, contentType,
      additionalHeaders) {
    writeHeader(response, httpStatus, merge({ 'Content-Type': contentType },
        additionalHeaders))
  }

  function writePlainTextHeader(response, httpStatus, additionalHeaders) {
    writeContentHeader(response, httpStatus, 'text/plain', additionalHeaders)
  }

  function writeJsonHeader(response, httpStatus, additionalHeaders) {
    writeContentHeader(response, httpStatus, 'application/json;charset=UTF-8',
        additionalHeaders)
  }

  this.createBackend = function() {
    var be = this.configReader.configuration.core.backend
    if (!be) {
      be = './backends/node_dirty_backend'
      log.warn('No backend is configured in configuration file (usually ' +
          'storra.yml), will use default backend: %s', be)
    }
    log.info('Using backend %s', be)
    var BackendConnector = require(be)
    this.backend = new BackendConnector()
    this.backend.init(this.configReader)
  }

  // GET /
  this.root = function(request, response) {
    writePlainTextHeader(response, 400)
    response.write('This is storra, the REST data store. Usage:\n')
    response.write('GET / to display this text,\n')
    response.write('GET /collection to list a collection of documents,\n')
    response.write('POST to /collection to create a new document,\n')
    response.write('GET /collection/key to retrieve a document,\n')
    response.write('PUT /collection/key to update a document or\n')
    response.write('DELETE /collection/key to delete a document.\n')
    response.end()
  }

  // OPTIONS *
  this.options = function(request, response) {
    writeNoContentHeader(response, 200)
    response.end();
    log.debug('responded to OPTIONS request')
  }

  // GET /collection
  this.list = function(request, response, collection) {
    var first = true
    self.backend.list(collection, function(document) {
      if (first) {
        // That's ugly - we write the 200 header when the first documents have
        // been read from the backend. If a error happens later, we can not
        // change that to 500 anymore.
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
          return self.internalServerError(response)
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
        log.debug('successfully listed %s', collection)
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
    self.backend.removeCollection(collection, function(err) {
      if (err) {
        log.error(err.stack)
        self.internalServerError(response)
      } else {
        writeNoContentHeader(response, 204)
        response.end()
        log.debug('successfully removed collection %s', collection)
      }
    })
  }

  // GET /collection/key
  this.retrieve = function(request, response, collection, key) {
    self.backend.read(collection, key, function(err, document, key) {
      if (err && err.httpStatus && err.httpStatus === 404) {
        self.notFound(response)
      } else if (err) {
        log.error(err.stack)
        self.internalServerError(response)
      } else {
        writeJsonHeader(response, 200)
        response.write(JSON.stringify(document))
        response.end()
        log.debug('successfully read %s/%s', collection, key)
      }
    })
  }

  // POST /collection
  this.create = function(request, response, collection) {
    createOrUpdate(request, response, function(bodyObject) {
      self.backend.create(collection, bodyObject, function(err, key) {
        if (err) {
          log.error('Error in backend.create: ' + err)
          self.internalServerError(response)
        } else {
          writeNoContentHeader(response, 201, {
            'location': fullUrl(request) + key,
            'x-storra-entity-key': key
          })
          response.end()
          log.debug('successfully inserted entry into %s -> %s', collection,
              key)
        }
      })
    })
  }

  // PUT /collection/key
  this.update = function(request, response, collection, key) {
    createOrUpdate(request, response, function(bodyObject) {
      self.backend.update(collection, key, bodyObject, function(err) {
        if (err) {
          if (err.httpStatus && err.httpStatus === 404) {
            self.notFound(response)
          } else {
            log.error(err)
            self.internalServerError(response)
          }
        } else {
          writeNoContentHeader(response, 204)
          response.end()
          log.debug('successfully updated %s/%s', collection, key)
        }
      })
    })
  }

  function createOrUpdate(request, response, upsert) {
    var body = ''
    request.on('data', function(chunk) {
      body += chunk.toString()
    })
    request.once('end', function() {
      request.removeAllListeners('data')
      var bodyObject
      try {
        /* (too chatty, even for debug) log.debug('Received body: ' + body) */
        bodyObject = JSON.parse(body)
      } catch (err) {
        log.error(err)
        self.badRequest(response,
            'Check the body of your request. Is it valid JSON?')
        return
      }
      upsert(bodyObject)
    })
  }

  // DELETE /collection/key
  this.remove = function(request, response, collection, key) {
    self.backend.remove(collection, key, function(err) {
      if (err) {
        log.error(err.stack)
        self.internalServerError(response)
      } else {
        writeNoContentHeader(response, 204)
        response.end()
        log.debug('successfully removed %s/%s', collection, key)
      }
    })
  }


  // 400
  this.badRequest = function(response, info) {
    log.info('400 Bad Request')
    writePlainTextHeader(response, 400)
    response.write('I\'m unable to process this request. I\'m terribly sorry.')
    if (info) {
      response.write('\nAdditional info: ' + info)
    }
    response.end()
  }

  // 404
  this.notFound = function notFound(response, additionalInfo) {
    log.info('404 Not Found')
    writePlainTextHeader(response, 404)
    response.write('The requested resource was not found. ')
    if (additionalInfo) {
      response.write(additionalInfo)
    }
    response.end()
  }

  // 500
  this.internalServerError = function internalServerError(response) {
    log.info('500 Internal Server Error')
    writePlainTextHeader(response, 500)
    response.write('Oops, something went wrong.')
    response.end()
  }

  // 501
  this.notImplemented = function(response) {
    log.info('501 Not Implemented')
    writeNoContentHeader(response, 501)
    response.end()
  }

  this.shutdown = function() {
    log.debug('requesthandler: shutting down')
    self.backend.closeConnection(function(err) {
      if (err) {
        log.error('An error occured when closing the database connection.')
        log.error(err.stack)
      } else {
        log.debug('Database connections have been closed.')
      }
    })
  }
}

module.exports = RequestHandler
