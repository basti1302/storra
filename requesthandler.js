'use strict'

/*
 * request handler:
 * - reads request body data (for POST and PUT)
 * - executes the requested storage action
 * - writes the response
 * - has methods for writing http error responses (4xx, 5xx)
 */

var url = require("url")

var log = require("./log")
var storage = require("./storage")

/* uuh, monkey patching String :-( */
String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
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
    var port = global.nstore_rest_server_port
    portInUrl = (protocol == 'http' && port == 80) || (protocol == 'https' && port == 443) ? '' : ':' + port
  }
  var fullUrl = protocol + '://' + host + portInUrl + url.parse(request.url).path
  if (!fullUrl.endsWith('/')) { fullUrl += '/' }
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

function root(request, response) {
  writePlainTextHeader(response, 400)
  response.write("This is the nstore-rest-server. Usage:\n")
  response.write("GET / to display this text,\n")
  response.write("GET /collection to list a collection of documents,\n")
  response.write("POST to /collection to create a new document (the new key is returned in the \"Location\" header),\n")
  response.write("GET /collection/key to retrieve a document,\n")
  response.write("PUT /collection/key to update a document or\n")
  response.write("DELETE /collection/key to delete a document.\n")
  response.end()
}

function options(request, response) {
  writeNoContentHeader(response, 200)
  response.end();
  log.debug("responded to OPTIONS request")
}

function list(request, response, collection) {
  storage.list(collection, function(err, resultObject) {
    if (err) { 
      log.error(err)
      internalServerError(response)
    } else {
      writeJsonHeader(response, 200)
      // probably pretty inefficient but somehow I can't get Query using streams to work
      var resultAsArray = []
      for (var key in resultObject) {
        var document = resultObject[key]
        document.nstore_key = key
        resultAsArray.push(document)
      }
      response.write(JSON.stringify(resultAsArray))

      // to write complete list as object instead of array
      // response.write(JSON.stringify(results))

      response.end()
      log.debug("successfully listed " + collection)
    }
  })
}

function removeCollection(request, response, collection) {
  storage.removeCollection(collection, function(err) {
    if (err) {
      log.error(err.stack)
      internalServerError(response)
    } else {
      writeNoContentHeader(response, 204)
      response.end()
      log.debug("successfully removed collection " + collection)
    }        
  })
}

function retrieve(request, response, collection, key) {
  storage.read(collection, key, function(err, document, key) {
    if (err) {
      log.debug(err)
      notFound(response)
    } else {
      writeJsonHeader(response, 200)
      document.nstore_key = key
      response.write(JSON.stringify(document))
      response.end()
      log.debug("successfully read " + collection + "/" + key)
    }
  })
}

function create(request, response, collection) {
  createOrUpdate(request, response, function(bodyObject) {
    storage.create(collection, bodyObject, function(err, key) {
      if (err) {
        log.error(err)
        internalServerError(response)
      } else {
        writeNoContentHeader(response, 201, {"Location": fullUrl(request) + collection + '/' + key})
        response.end()
        log.debug("successfully inserted entry into " + collection + " -> " + key)
      }
    })
  })
}

function update(request, response, collection, key) {
  createOrUpdate(request, response, function(bodyObject) {
    storage.update(collection, key, bodyObject, function(err) {
      if (err) {
        if (err == 404) {
          notFound(response)
        } else {
          log.error(err)
          internalServerError(response)
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
      badRequest(response, "Check the body of your request. Is it valid JSON?")
      return
    }
    upsert(bodyObject)
  })
}

function remove(request, response, collection, key) {
  storage.remove(collection, key, function(err) {
    if (err) {
      log.error(err.stack)
      internalServerError(response)
    } else {
      writeNoContentHeader(response, 204)
      response.end()
      log.debug("successfully removed " + collection + "/" + key)
    }        
  })
}


function badRequest(response, info) {
  log.info("400 Bad Request")
  writePlainTextHeader(response, 400)
  response.write("I'm unable to process this request. I'm terribly sorry.")
  if (info) {
    response.write("\nAdditional info: " + info)
  }
  response.end()
}

function notFound(response) {
  log.info("404 Not Found")
  writePlainTextHeader(response, 400)
  response.write("The requested resource was not found.")
  response.end()
}

function internalServerError(response) {
  log.info("500 Internal Server Error")
  writePlainTextHeader(response, 500)
  response.write("Oops, something went wrong.")
  response.end()
}

function notImplemented(response) {
  log.info("501 Not Implemented")
  writeNoContentHeader(response, 501)
  response.end()
}

// GET /
exports.root = root
// OPTIONS *
exports.options = options

// GET /collection
exports.list = list
// DELETE /collection
exports.removeCollection = removeCollection
// GET /collection/key
exports.retrieve = retrieve
// POST /collection
exports.create = create

// PUT /collection/key
exports.update = update
// DELETE /collection/key
exports.remove = remove


// 400
exports.badRequest = badRequest
// 404
exports.notFound = notFound
// 500
exports.internalServerError = internalServerError
// 501
exports.notImplemented = notImplemented
