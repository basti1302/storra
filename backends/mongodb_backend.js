'use strict'

/*
 * Wrapper for MongoDB.
 */

// TODO Make that configurable via storra.mongodb.yml
var MAX_RETRIES = 20
var TIME_BETWEEN_RETRIES = 50
// TODO Needs to be parameterizable from outside (yaml)
var database = 'storra'

var log = require('../log')
var MongoClient = require('mongodb').MongoClient
var Server = require('mongodb').Server
var mongoClient = new MongoClient(new Server('localhost', 27017, {auto_connect: true, poolSize: 10}));
var ObjectID = require('mongodb').ObjectID

// TODO Keep open mongodb connection. 
// - when to close mongoClient.close()?? -> when node process exits, but
//   - do we really need to do that ourselves or are the connections closed automatically
//   - if we need to do it, how to?

// TODO Refactor accessing collection into a method of its own

// TODO Also cache collection objects? But maybe it's cheap to access them every time
// without using a cache (and probably safer)

exports.list = function list(collectionName, writeResponse) {
  log.debug("listing " + collectionName)
  openConnection(function(err, mongoClient) {
    if (err) {
      writeResponse(err, null)
    } else {
      var db = mongoClient.db(database)

      // TODO: We need chunking/streaming here, to write back large result sets back to the
      // response in chunks, probably calling ourselves recursivly per process.nextTick to allow
      // other requests to be handled in between the chunks, otherwise the listing of large collections
      // block here. This also influences how requesthandler writes the response, see the TODO there.
      var results = [] 
      db.collection(collectionName).find().each(function(err, doc) {
        if (err) {
          writeResponse(err, null)
        } else if (doc) {
          log.debug("listing entry: " + JSON.stringify(doc))
          results.push(doc)
        } else {
          // db cursor exhausted, no more results -> write response
          writeResponse(err, results)
        }
      })
    }
  })
}

exports.removeCollection = function removeCollection(collectionName, writeResponse) {
  log.debug("removing collection " + collectionName)
  openConnection(function(err, mongoClient) {
    if (err) {
      writeResponse(err)
    } else {
      var db = mongoClient.db(database)
      db.dropCollection(collectionName, function(err, result) {
        // log.error(err.errmsg)
        // help node-mongodb-native to be idempotent, that is, ignore error if
        // collection to be removed does not exist.
        if (err && (err.message === 'ns not found' || err.errmsg === 'ns not found')) {
          log.debug("Ignoring 'ns not found' error during removeCollection")
          err = null
        }
        writeResponse(err)
      })
    }
  })
}

exports.read = function read(collectionName, key, writeResponse) {
  log.debug("reading item " + collectionName + "/" + key)
  openConnection(function(err, mongoClient) {
    if (err) {
      writeResponse(err, null, key)
    } else {
      var db = mongoClient.db(database)
      db.collection(collectionName).findOne({_id: new ObjectID(key) }, function(err, doc) {
        if (err) {
          writeResponse(err, null, key)
        } else {
          if (doc) {
            writeResponse(err, doc, key)
          } else {
            writeResponse(404, null, key)
          }
        }
      })
    }
  })
}

exports.create = function create(collectionName, doc, writeResponse) {
  log.debug("creating item in " + collectionName)
  openConnection(function(err, mongoClient) {
    if (err) {
      writeResponse(err, null)
    } else {
      var db = mongoClient.db(database)
      db.collection(collectionName).insert(doc, {}, function(err, result) {
        if (err) {
          writeResponse(err, null)
        } else {
          if (result) {
            var oid = result[0]['_id'].toHexString()
            writeResponse(err, oid)
          } else {
            writeResponse(err, null)
          }
        }
      })
    }
  })
}

exports.update = function update(collectionName, key, doc, writeResponse) {
  log.debug("updating item " + collectionName + "/" + key)
  openConnection(function(err, mongoClient) {
    if (err) {
      writeResponse(err, undefined)
    } else {
      var db = mongoClient.db(database)
      db.collection(collectionName).update({_id: new ObjectID(key)}, doc, {}, function(err, result) {
        if (result == 0) {
          writeResponse(404) 
        } else if (result > 1) {
          // This will never happen™.
          writeResponse(new Error('An update changed ' + result + ' documents instead of one.'))
        } else {
          writeResponse(err)
        }
      })
    }
  })
}

exports.remove = function remove(collectionName, key, writeResponse) {
  log.debug("removing item " + collectionName + "/" + key)
  openConnection(function(err, mongoClient) {
    if (err) {
      writeResponse(err, undefined)
    } else {
      var db = mongoClient.db(database)
      db.collection(collectionName).remove({_id: new ObjectID(key)}, function(err, numberOfRemovedDocs) {
        log.debug("Removed " + numberOfRemovedDocs + " documents")
        writeResponse(err)
      })
    }
  })
}

exports.closeConnection = function closeConnection(callback) {
  log.debug("closing connection to MongoDB")
  mongoClient.close(function(err, result) {
    callback(err)
  })
}

function openConnection(callback, retriesLeft) {
  // We are using a log of mongodb client lib's internals here
  // Can we do better than this?
  if (!mongoClient._db.openCalled) {
    // connection not yet or no longer open, connect now
    log.debug('MongoDB not yet connected, establishing connection now.')
    reallyOpenConnection(callback)
  } else if (mongoClient._db._state === 'connected') {
    // connection already open, do nothing
    callback(null, mongoClient)
  } else if (mongoClient._db._state === 'connecting') {
    // connection has been requested before, but has not been fully established yet
    // we wait and poll until the connection has been established or MAX_RETRIES is
    // reached
    log.warn('Connection to MongoDB is currently being established, waiting/retrying.')
    if (retriesLeft === undefined) {
      retriesLeft = MAX_RETRIES
    } 
    if (retriesLeft === 0) {
      var err = 'Could not connect to MongoDB after ' + MAX_RETRIES + ' retries, MongoClient is still in state connecting.'
      callback(err, null)
    } else {
      // retry later/wait for connection to be established
      setTimeout(function() {
        log.debug('in retry callback')
        openConnection(callback, retriesLeft - 1)
      }, TIME_BETWEEN_RETRIES)
    }
  } else {
    var err = 'Unexpected state of MongoClient: Connection has already been opened but connection state is ' + mongoClient._db._state + '.'
    callback(err, null)
  }
}

function reallyOpenConnection(callback) {
  mongoClient.open(function(err, mongoClient) {
    callback(err, mongoClient)
  })
}

/*
function dumpMongoState(label) {
  log.error(label)
  log.error('openCalled: ' + mongoClient._db.openCalled)
  log.error('_state    : ' + mongoClient._db._state)
}
*/
