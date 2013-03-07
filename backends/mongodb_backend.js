'use strict'

/*
 * Wrapper for MongoDB.
 */

var log = require('../log')

global.storra_config.mergeDefaults({
  mongodb: {
    connection_max_retries: 20,
    connection_time_between_retries: 50,
    database: 'storra'
  }
})
log.debug('MongoDB configuration, merged with defaults:\n' + JSON.stringify(global.storra_config.mongodb))
var maxRetries          = global.storra_config.mongodb.connection_max_retries
var timeBetweenRetries  = global.storra_config.mongodb.connection_time_between_retries
var database            = global.storra_config.mongodb.database

var MongoClient = require('mongodb').MongoClient
var Server = require('mongodb').Server
var mongoClient = new MongoClient(new Server('localhost', 27017, {auto_connect: true, poolSize: 10}));
var ObjectID = require('mongodb').ObjectID

// Also cache collection objects? But maybe it's cheap to access them every time
// without using a cache (and probably safer)?

exports.list = function list(collectionName, writeResponse) {
  log.debug("listing " + collectionName)
  openConnection(function(err, mongoClient) {
    // TODO: We need chunking/streaming here, to write back large result sets back to the
    // response in smaller chunks or even doc by doc, probably calling ourselves recursivly per process.nextTick to allow
    // other requests to be handled in between the chunks, otherwise the listing of large collections
    // block here. This also influences how requesthandler writes the response, see the TODO there.
    withCollectionDo(mongoClient, collectionName, function(collection) {
      var results = [] 
      collection.find().each(function(err, doc) {
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
    })
  }, writeResponse)
}

exports.removeCollection = function removeCollection(collectionName, writeResponse) {
  log.debug("removing collection " + collectionName)
  openConnection(function(err, mongoClient) {
    db().dropCollection(collectionName, function(err, result) {
      // help node-mongodb-native to be idempotent, that is, ignore error if
      // collection to be removed does not exist.
      if (err && (err.message === 'ns not found' || err.errmsg === 'ns not found')) {
        log.debug("Ignoring 'ns not found' error during removeCollection")
        err = null
      }
      writeResponse(err)
    })
  }, writeResponse)
}

exports.read = function read(collectionName, key, writeResponse) {
  log.debug("reading item " + collectionName + "/" + key)
  openConnection(function(err, mongoClient) {
    withCollectionDo(mongoClient, collectionName, function(collection) {
      collection.findOne({_id: new ObjectID(key) }, function(err, doc) {
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
    })
  }, writeResponse)
}

exports.create = function create(collectionName, doc, writeResponse) {
  log.debug("creating item in " + collectionName)
  openConnection(function(err, mongoClient) {
    withCollectionDo(mongoClient, collectionName, function(collection) {
      collection.insert(doc, {}, function(err, result) {
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
    })
  }, writeResponse)
}

exports.update = function update(collectionName, key, doc, writeResponse) {
  log.debug("updating item " + collectionName + "/" + key)
  openConnection(function(err, mongoClient) {
    withCollectionDo(mongoClient, collectionName, function(collection) {
      collection.update({_id: new ObjectID(key)}, doc, {}, function(err, result) {
        if (result == 0) {
          writeResponse(404) 
        } else if (result > 1) {
          // This will never happen™.
          writeResponse(new Error('An update changed ' + result + ' documents instead of one.'))
        } else {
          writeResponse(err)
        }
      })
    })
  }, writeResponse)
}

exports.remove = function remove(collectionName, key, writeResponse) {
  log.debug("removing item " + collectionName + "/" + key)
  openConnection(function(err, mongoClient) {
    withCollectionDo(mongoClient, collectionName, function(collection) {
      collection.remove({_id: new ObjectID(key)}, function(err, numberOfRemovedDocs) {
        log.debug("Removed " + numberOfRemovedDocs + " documents")
        writeResponse(err)
      })
    })
  }, writeResponse)
}

exports.closeConnection = function closeConnection(callback) {
  log.debug("closing connection to MongoDB")
  mongoClient.close(function(err, result) {
    // TODO Introduce this check in all other backends
    if (callback && typeof callback == 'function') {
      callback(err)
    }
  })
}

exports.setRetryParameters = function(_maxRetries, _timeBetweenRetries) {
  maxRetries = _maxRetries
  timeBetweenRetries = _timeBetweenRetries
}

function openConnection(callback, writeResponse, retriesLeft) {
  // TODO We are using a log of mongodb client lib's internals here
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
    // we wait and poll until the connection has been established or maxRetries is
    // reached
    log.warn('Connection to MongoDB is currently being established, waiting/retrying.')
    if (retriesLeft === undefined) {
      retriesLeft = maxRetries
    } 
    if (retriesLeft === 0) {
      var err = 'Could not connect to MongoDB after ' + maxRetries + ' retries, MongoClient is still in state connecting.'
      onConnectError(err, writeResponse)
    } else {
      // retry later/wait for connection to be established
      setTimeout(function() {
        log.debug('in retry callback')
        openConnection(callback, writeResponse, retriesLeft - 1)
      }, timeBetweenRetries)
    }
  } else {
    var err = 'Unexpected state of MongoClient: Connection has already been opened but connection state is ' + mongoClient._db._state + '.'
    onConnectError(err, writeResponse)
  }
}

function reallyOpenConnection(callback) {
  mongoClient.open(function(err, mongoClient) {
    callback(err, mongoClient)
  })
}

function onConnectError(err, writeResponse) {
  writeResponse(err)
}

function withCollectionDo(mongoClient, collectionName, callback) {
  callback(db().collection(collectionName))
}

function db() {
  return mongoClient.db(database)
}

/*
// keep this around for debugging purposes
function dumpMongoState(label) {
  log.error(label)
  log.error('openCalled: ' + mongoClient._db.openCalled)
  log.error('_state    : ' + mongoClient._db._state)
}
*/
