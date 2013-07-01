'use strict';

/*
 * Wrapper for node-dirty.
 *
 * Accesses the in-memory database.
 */

var fs = require('fs');
var dirty = require('dirty')
var uuid = require('node-uuid')

var cache = new (require ('./collection_cache'))()
var log = require('../log')

function NodeDirtyConnector() {

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
      writeEnd(null)
    })
  }

  // Duplication: Same code as for nStore backend
  this.removeCollection = function(collectionName, writeResponse) {
    log.debug('removing collection %s', collectionName)

    // For now, we just do a hard filesystem delete on the file.
    // Of course, this is bound to break on concurrent requests.
    var databaseFilename = getDatabaseFilename(collectionName)
    cache.remove(databaseFilename)
    fs.exists(databaseFilename, function (exists) {
      if (exists) {
        fs.unlink(databaseFilename, function (err) {
          // ignore error number 34/ENOENT, might happen if a concurrent
          // removeCollection alread killed the file
          if (err && err.errno && err.errno === 34) {
            log.warn('Ignoring: %j', err)
            err = undefined
          }
          writeResponse(err)
        })
      } else {
        log.debug('%s does not exist, doing nothing.', databaseFilename)
        writeResponse(null)
      }
    })
  }

  this.read = function(collectionName, key, writeResponse) {
    withCollectionDo(collectionName, function(collection) {
      log.debug('reading %s/%s', collectionName, key)
      var doc = collection.get(key)
      if (doc) {
        doc._id = key
        log.debug('read result', JSON.stringify(doc))
        writeResponse(undefined, doc, key)
      } else {
        writeResponse(create404(), null, key)
      }
    })
  }

  this.create = function(collectionName, doc, writeResponse) {
    log.debug('creating item in %s', collectionName)
    var collection = openCollection(collectionName)
    // using uuid.v4() might give even "better" uuid, but is also more expensive
    var key = uuid.v1()
    collection.set(key, doc)
    writeResponse(undefined, key)
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
        writeResponse(undefined)
      } else {
        writeResponse(create404())
      }
    })
  }

  this.remove = function(collectionName, key, writeResponse) {
    log.debug('removing item %s/%s',  collectionName, key)
    var collection = openCollection(collectionName)
    collection.rm(key)
    writeResponse()
  }

  this.closeConnection = function closeConnection(callback) {
    log.debug('closeConnection has no effect with the node-dirty backend.')
    if (callback && typeof callback === 'function') {
      callback(undefined)
    }
  }

  /*
   * For write access only, use the (potentially faster) method openCollection.
   * For read access, use this method and pass a callback.
   */
  function withCollectionDo(collectionName, callback) {
    accessCollection(collectionName, callback)
  }

  /*
   * According to node-dirty docs you can safely write to the collection (db in
   * their terms) directly. To safely read from the collection, you need to wait
   * for the event 'load', however. See withCollectionDo.
   */
  function openCollection(collectionName) {
    return accessCollection(collectionName, undefined)
  }

  /* To be used only from withCollectionDo and openCollection */
  function accessCollection(collectionName, callback) {
    var databaseFilename = getDatabaseFilename(collectionName)
    var collection = cache.get(databaseFilename)
    if (collection) {
      log.debug('accessing collection %s via cached collection object.',
          databaseFilename)
      if (callback) {
        callback(collection)
      }
      return collection
    } else {
      log.debug('collection %s was not in cache.', collectionName)
      collection = dirty.Dirty(databaseFilename)
      collection.on('load', function() {
        log.debug('collection %s created/loaded.', collectionName)
        cache.put(databaseFilename, collection)
        if (callback) {
          callback(collection)
        }
      })
      return collection
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
