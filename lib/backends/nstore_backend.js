'use strict'

/*
 * Wrapper for nStore.
 * 
 * Accesses the in-memory database.
 */

var fs = require('fs');
var nStore = require('nstore')
nStore = nStore.extend(require('nstore/query')())

var cache = new (require ('./collection_cache'))()
var log = require('../log')

module.exports = NStoreConnector

function NStoreConnector() {

  this.checkAvailable = function(callbackAvailable, callbackNotAvailable) {
    callbackAvailable()
  }

  this.list = function list(collectionName, writeDocument, writeEnd) {
    log.debug("listing " + collectionName)
    withCollectionDo(collectionName, function(collection) {
      collection.all(function(err, results) {
        if (err) {
          writeEnd(err)
        } else {
          iterateThroughObject(results, writeDocument)
          writeEnd(null)
        }
      })
    })  
  }

  // Duplication: Same code as for node-dirty backend
  this.removeCollection = function removeCollection(collectionName, writeResponse) {
    log.debug("removing collection " + collectionName)

    // according to nstore docs the following should work, but clear
    // isn't even implemented. WTF?
    // collection.clear(function (err) {
    //  writeResponse(err)
    //})

    // For now, we just do a hard filesystem delete on the file.
    // Of course, this is bound to break on concurrent requests.
    var file = getDatabaseFilename(collectionName)
    cache.remove(file)
    fs.exists(file, function (exists) {
      if (exists) {
        fs.unlink(file, function (err) {
          // ignore error number 34/ENOENT, might happen if a concurrent removeCollection alread killed the file
          if (err && err.errno && err.errno === 34) {
            log.warn("Ignoring: " + err)
            err = undefined
          }
          writeResponse(err)
        })
      } else {
        log.debug(file + " does not exist, doing nothing.")
        writeResponse(null)
      }
    })
  }

  this.read = function read(collectionName, key, writeResponse) {
    withCollectionDo(collectionName, function(collection) {
      log.debug("reading " + collectionName + "/" + key)
      collection.get(key, function (err, doc, key2) {
        if (err && err.message == 'Document does not exist for ' + key) {
          writeResponse(create404(), null, key2)
        } else {
          doc._id = key2
          writeResponse(err, doc, key2)
        }
      })
    })
  }

  this.create = function create(collectionName, doc, writeResponse) {
    log.debug("creating item in " + collectionName)
    withCollectionDo(collectionName, function(collection) {
      collection.save(null, doc, function (err, key) {
        writeResponse(err, key)
      })
    })
  }

  this.update = function update(collectionName, key, doc, writeResponse) {
    log.debug("updating item " + collectionName + "/" + key)
    withCollectionDo(collectionName, function(collection) {
      // call get to make sure the key exist, otherwise we need to 404
      collection.get(key, function (err) {
        // TODO Differentiate between 404 and other errors!
        if (err) { 
          writeResponse(create404()) 
        } else {
          collection.save(key, doc, function (err) {
            writeResponse(err)
          })    
        }
      })
    })
  }

  this.remove = function remove(collectionName, key, writeResponse) {
    log.debug("removing item " + collectionName + "/" + key)
    withCollectionDo(collectionName, function(collection) {
      collection.remove(key, function (err) {
        if (err) { log.error(err.stack) }
        writeResponse()
      })
    })
  }

  this.closeConnection = function closeConnection(callback) {
    log.debug("closeConnection has no effect with the nStore backend.")
    if (callback && typeof callback == 'function') {
      callback(undefined)
    }
  }


  function withCollectionDo(collectionName, callback) {
    var name = getDatabaseFilename(collectionName)
    var collection = cache.get(name)
     if (collection) {
      log.debug('accessing collection ' + name + ' via cached collection object.') 
      callback(collection)
    } else {
      collection = nStore.new(name, function (err) {
        log.debug('collection ' + name + ' was not in cache.') 
        if (err) { throw err }
        log.debug("collection " + collectionName + " created/loaded.")
        cache.put(name, collection)
        callback(collection)
      })
    }
  }

  function getDatabaseFilename(collectionName) {
    return 'data/' + collectionName + '.nstore.db'
  }

  function iterateThroughObject(obj, cb) {
    // nStore queries return an object not an array. Thus, we need to treat this
    // like an array and iterate through it.
   
    for (var key in obj) {
      var doc = obj[key]
      doc._id = key
      cb(doc)
    }
  }

  function create404() {
    var error = new Error("not found")
    error.http_status = 404
    return error
  }
}
