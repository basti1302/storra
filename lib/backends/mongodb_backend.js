'use strict';

/*
 * Wrapper for MongoDB.
 */

var log = require('../log')

function MongoDBConnector() {

  var self = this

  // Also cache collection objects? But maybe it's cheap to access them
  // every time without using a cache (and probably safer)?

  this.init = function(configReader) {
    configReader.mergeDefaultsIntoCurrentConfiguration({
      mongodb: {
        connectionMaxRetries: 20,
        connectionTimeBetweenRetries: 50,
        database: 'storra'
      }
    })
    log.debug('MongoDB configuration, merged with defaults:',
        configReader.configuration.mongodb)

    this.maxRetries = configReader.configuration.mongodb.connectionMaxRetries
    this.timeBetweenRetries =
        configReader.configuration.mongodb.connectionTimeBetweenRetries
    this.database = configReader.configuration.mongodb.database

    /* jshint -W106 */
    var mongoServer = new this.mongodb.Server('localhost', 27017,
        {auto_connect: true, poolSize: 10}
    )
    this.mongoClient = new this.mongodb.MongoClient(mongoServer)
    /* jshint +W106 */
  }

  this.checkAvailable = function(callbackAvailable, callbackNotAvailable) {
    openConnection(function(err) {
      if (err) {
        return callbackNotAvailable(err)
      } else {
        return callbackAvailable()
      }
    })
  }

  this.list = function(collectionName, writeDocument, writeEnd) {
    log.debug('listing %s')
    openConnection(function(err, mongoClient) {
      if (err) {
        return writeResponse(err)
      }
      checkIfCollectionExists(collectionName, function(err, found) {
        if (err) {
          return writeEnd(err)
        }
        if (found) {
          withCollectionDo(mongoClient, collectionName, function(collection) {
            // TODO: Right now we push each single document to the http
            // response. It might be more efficient to buffer a number of
            // documents and push them through in larger chunks.
            collection.find().each(function(err, doc) {
              if (err) {
                return writeEnd(err)
              } else if (doc) {
                log.debug('listing entry: ', doc)
                writeDocument(doc)
              } else {
                // db cursor exhausted, no more results
                return writeEnd(null)
              }
            })
          })
        } else  { // not found
          log.debug('collection %s does not exist', collectionName)
          return writeEnd(create404())
        }
      })
    }, writeEnd)
  }

  this.createCollection = function(collectionName, writeResponse) {
    log.debug('creating collection %s', collectionName)
    openConnection(function(err, mongoClient) {
      if (err) {
        return writeResponse(err)
      }
      checkIfCollectionExists(collectionName, function(err, found) {
        if (err) {
          return writeResponse(err)
        }
        if (!found) {
          db().createCollection(collectionName, null, function(err, result) {
            if (err) {
              return writeResponse(err)
            }
            // result of createCollection is ignored, as long as there is no
            // error, we do not care about the specifics of the created
            // collection.
            return writeResponse()
          })
        } else {
          return writeResponse(create409('collection', collectionName))
        }
      })
    })
  }

  this.removeCollection =
      function removeCollection(collectionName, writeResponse) {
    log.debug('removing collection %s', collectionName)
    openConnection(function(err, mongoClient) {
      if (err) {
        writeResponse(err)
      }
      db().dropCollection(collectionName, function(err, result) {
        // help node-mongodb-native to be idempotent, that is, ignore error if
        // collection to be removed does not exist.
        if (err && (err.message === 'ns not found' ||
            err.errmsg === 'ns not found')) {
          log.debug('Ignoring \'ns not found\' error during removeCollection')
          err = null
        }
        writeResponse(err)
      })
    }, writeResponse)
  }

  this.read = function(collectionName, key, writeResponse) {
    log.debug('reading item %s/%s', collectionName, key)
    openConnection(function(err, mongoClient) {
      withCollectionDo(mongoClient, collectionName, function(collection) {
        collection.findOne({_id: new self.mongodb.ObjectID(key) },
            function(err, doc) {
          if (err) {
            writeResponse(err, null, key)
          } else {
            if (doc) {
              writeResponse(err, doc, key)
            } else {
              writeResponse(create404(), null, key)
            }
          }
        })
      })
    }, writeResponse)
  }


  this.create = function(collectionName, doc, writeResponse) {
    log.debug('creating item in %s', collectionName)
    openConnection(function(err, mongoClient) {
      withCollectionDo(mongoClient, collectionName, function(collection) {
        collection.insert(doc, {}, function(err, result) {
          if (err) {
            writeResponse(err, null)
          } else {
            if (result) {
              var oid = result[0]._id.toHexString()
              writeResponse(err, oid)
            } else {
              writeResponse(err, null)
            }
          }
        })
      })
    }, writeResponse)
  }

  this.update = function(collectionName, key, doc, writeResponse) {
    log.debug('updating item %s/%s', collectionName, key)
    openConnection(function(err, mongoClient) {
      withCollectionDo(mongoClient, collectionName, function(collection) {
        doc._id = new self.mongodb.ObjectID(key)
        collection.update({_id: doc._id}, doc, {}, function(err, result) {
          if (result === 0) {
            writeResponse(create404())
          } else if (result > 1) {
            // This will never happen™.
            writeResponse(new Error('An update changed ' + result +
                ' documents instead of one.'))
          } else {
            writeResponse(err)
          }
        })
      })
    }, writeResponse)
  }

  this.remove = function(collectionName, key, writeResponse) {
    log.debug('removing item %s/%s', collectionName, key)
    openConnection(function(err, mongoClient) {
      withCollectionDo(mongoClient, collectionName, function(collection) {
        collection.remove({_id: new self.mongodb.ObjectID(key)},
            function(err, numberOfRemovedDocs) {
          log.debug('removed %d documents', numberOfRemovedDocs)
          writeResponse(err)
        })
      })
    }, writeResponse)
  }

  this.closeConnection = function closeConnection(callback) {
    log.debug('closing connection to MongoDB')
    this.mongoClient.close(function(err, result) {
      if (callback && typeof callback === 'function') {
        callback(err)
      }
    })
  }

  this.setRetryParameters = function(maxRetries, timeBetweenRetries) {
    this.maxRetries = maxRetries
    this.timeBetweenRetries = timeBetweenRetries
  }

  function openConnection(callback, writeResponse, retriesLeft) {
    // TODO We are using a lot of mongodb client lib's internals here
    // Can we do better than this?
    var err = null
    if (!self.mongoClient._db.openCalled) {
      // connection not yet or no longer open, connect now
      log.debug('MongoDB not yet connected, establishing connection now.')
      reallyOpenConnection(callback)
    } else if (self.mongoClient._db._state === 'connected') {
      // connection already open, do nothing
      callback(null, self.mongoClient)
    } else if (self.mongoClient._db._state === 'connecting') {
      // connection has been requested before, but has not been fully
      // established yet we wait and poll until the connection has been
      // established or maxRetries is reached
      log.warn('Connection to MongoDB is currently being established, ' +
          'waiting/retrying.')
      if (retriesLeft === undefined) {
        retriesLeft = self.maxRetries
      }
      if (retriesLeft === 0) {
        err = new Error('Could not connect to MongoDB after ' +
            self.maxRetries + ' retries, MongoClient is still in state ' +
            'connecting.')
        onConnectError(err, writeResponse)
      } else {
        // retry later/wait for connection to be established
        setTimeout(function() {
          log.debug('in retry callback')
          openConnection(callback, writeResponse, retriesLeft - 1)
        }, self.timeBetweenRetries)
      }
    } else {
      err = 'Unexpected state of MongoClient: Connection has already been ' +
          'opened but connection state is ' + self.mongoClient._db._state + '.'
      onConnectError(err, writeResponse)
    }
  }

  function reallyOpenConnection(callback) {
    self.mongoClient.open(function(err, mongoClient) {
      callback(err, mongoClient)
    })
  }

  function onConnectError(err, writeResponse) {
    err.httpStatus = 500
    writeResponse(err)
  }

  function withCollectionDo(mongoClient, collectionName, callback) {
    callback(db().collection(collectionName))
  }

  function checkIfCollectionExists(collectionName, callback) {
    db().collectionNames(collectionName, {namesOnly: true},
      function(err, existingCollectionNames) {
      if (err) {
        return callback(err, null)
      }
      var fqCollectionName = self.database + '.' + collectionName
      for (var i = 0; i < existingCollectionNames.length; i++) {
        var existingCollection = existingCollectionNames[i]
        if (existingCollection === fqCollectionName) {
          log.debug('collection %s exists', collectionName)
          return callback(null, true)
        }
      }
      return callback(null, false)
    })
  }

  function db() {
    return self.mongoClient.db(self.database)
  }

  function create404() {
    var error = new Error('not found')
    error.httpStatus = 404
    return error
  }

  function create409(type, name) {
    var error = new Error(type + ' already exists: ' + name)
    error.httpStatus = 409
    return error
  }
}

module.exports = MongoDBConnector
