'use strict';

/*
 * Wrapper for node-dirty.
 *
 * Accesses the in-memory database.
 */

var dirty = require('dirty')
var uuid = require('node-uuid')

var log = require('../log')

function NodeDirtyConnector() {

  var self = this
  this.cache = new (require ('./collection_cache'))()

  this.init = function(configReader) {
    // nothing to do
  }

  this.checkAvailable = function(callbackAvailable, callbackNotAvailable) {
    callbackAvailable()
  }

  this.list = function(collectionName, writeDocument, writeEnd) {
    log.debug('listing %s', collectionName)
    withCollectionDo(collectionName, function(collection) {
      collection.forEach(function(key, doc) {
        if (doc) {
          doc._id = key
          writeDocument(doc)
        } else {
          log.warn('node-dirty backend handed empty doc to callback, key: %s',
              key)
        }
      })
      return writeEnd(null)
    })
  }

  // Duplication: Same code as for nStore backend
  this.removeCollection = function(collectionName, writeResponse) {
    log.debug('removing collection %s', collectionName)

    // For now, we just do a hard filesystem delete on the file.
    // Of course, this is bound to break on concurrent requests.
    var databaseFilename = getDatabaseFilename(collectionName)
    this.cache.remove(databaseFilename)
    this.fs.exists(databaseFilename, function (exists) {
      if (exists) {
        log.debug('file %s exists, needs to be unlinked', databaseFilename)
        // fs.unlink on windows behaves weird... often the file just stays there
        // although the unlink callback receives no err. This causes hard to
        // debug subsequent errors. Instead of deleting the file, we at least
        // truncate it.
        if (self.os.platform() === 'win32') {
          self.fs.truncate(databaseFilename, function(err) {
            if (!err) {
              log.debug('file %s has been unlinked', databaseFilename)
            } else {
              log.error('could not unlink file %s', databaseFilename)
            }
            return writeResponse(err)
          })
        } else {
          self.fs.unlink(databaseFilename, function (err) {
            // ignore error number 34/ENOENT, might happen if a concurrent
            // removeCollection alread killed the file
            if (err && err.errno && err.errno === 34) {
              log.warn('Ignoring: %j', err)
            } else if (err) {
              log.error('could not unlink file %s', databaseFilename)
            } else {
              log.debug('file %s has been unlinked', databaseFilename)
            }
            return writeResponse(err)
          })
        }
      } else {
        log.debug('%s does not exist, doing nothing.', databaseFilename)
        return writeResponse(null)
      }
    })
  }

  this.read = function(collectionName, key, writeResponse) {
    withCollectionDo(collectionName, function(collection) {
      log.debug('reading %s/%s', collectionName, key)
      var doc = collection.get(key)
      if (doc) {
        doc._id = key
        log.debug('read result %s', JSON.stringify(doc))
        return writeResponse(null, doc, key)
      } else {
        log.debug('not found: %s/%s', collectionName, key)
        return writeResponse(create404(), null, key)
      }
    })
  }

  this.create = function(collectionName, doc, writeResponse) {
    log.debug('creating item in %s', collectionName)
    withCollectionDo(collectionName, function(collection) {
      // using uuid.v4() might give even "better" uuid, but is also more
      // expensive
      var key = uuid.v1()
      collection.set(key, doc)
      return writeResponse(null, key)
    })
  }

  this.update = function(collectionName, key, doc, writeResponse) {
    log.debug('updating item %s/%s: %j', collectionName, key, doc)
    withCollectionDo(collectionName, function(collection) {
      // call get to make sure the key exist, otherwise we need to 404
      var existingDoc = collection.get(key)
      if (existingDoc) {
        log.debug('now really updating item %s/%s: %j', collectionName, key,
            doc)
        collection.set(key, doc)
        return writeResponse(null)
      } else {
        return writeResponse(create404())
      }
    })
  }

  this.remove = function(collectionName, key, writeResponse) {
    log.debug('removing item %s/%s',  collectionName, key)
    withCollectionDo(collectionName, function(collection) {
      collection.rm(key)
      return writeResponse()
    })
  }

  this.closeConnection = function closeConnection(callback) {
    log.debug('closeConnection has no effect with the node-dirty backend.')
    if (callback && typeof callback === 'function') {
      return callback(null)
    }
  }

  function withCollectionDo(collectionName, callback) {
    var databaseFilename = getDatabaseFilename(collectionName)
    var collection = self.cache.get(databaseFilename)
    if (collection) {
      log.debug('accessing collection %s via cached collection object.',
          databaseFilename)
      return callback(collection)
    } else {
      log.debug('collection %s was not in cache.', collectionName)
      collection = self.dirty.Dirty(databaseFilename)
      collection.once('load', function() {
        log.debug('collection %s created/loaded.', collectionName)
        self.cache.put(databaseFilename, collection)
        return callback(collection)
      })
    }
  }

  function getDatabaseFilename(collectionName) {
    return 'data/' + collectionName + '.node-dirty.db'
  }

  function create404() {
    var error = new Error('not found')
    error.httpStatus = 404
    return error
  }
}

module.exports = NodeDirtyConnector
