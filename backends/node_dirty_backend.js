'use strict'

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

exports.list = function list(collectionName, writeResponse) {
  log.debug("listing " + collectionName)
  withCollectionDo(collectionName, function(collection) {
    var results = {}
    collection.forEach(function(key, doc) {
      results[key] = doc
    })
    writeResponse(undefined, results)
  })
}

// Duplication: Same code as for nStore backend
exports.removeCollection = function removeCollection(collectionName, writeResponse) {
  log.debug("removing collection " + collectionName)

  // For now, we just do a hard filesystem delete on the file.
  // Of course, this is bound to break on concurrent requests.
  var file = getDatabaseFilename(collectionName)
  cache.remove(file)
  fs.exists(file, function (exists) {
    if (exists) {
      fs.unlink(file, function (err) {
        writeResponse(err)
      })
    } else {
      log.debug(file + " does not exist, doing nothing.")
      writeResponse(null)
    }
  })
}

exports.read = function read(collectionName, key, writeResponse) {
  withCollectionDo(collectionName, function(collection) {
    log.debug("reading " + collectionName + "/" + key)
    var doc = collection.get(key) 
    if (doc) {
      writeResponse(undefined, doc, key)
    } else {
      writeResponse(404, null, key)
    }
  })
}

exports.create = function create(collectionName, doc, writeResponse) {
  log.debug("creating item in " + collectionName)
  var collection = openCollection(collectionName)
  // using uuid.v4() might give even "better" uuid, but is also more expansive
  var key = uuid.v1()
  collection.set(key, doc)
  writeResponse(undefined, key)
}

exports.update = function update(collectionName, key, doc, writeResponse) {
  log.debug("updating item " + collectionName + "/" + key)
  withCollectionDo(collectionName, function(collection) {
    // call get to make sure the key exist, otherwise we need to 404
    var existingDoc = collection.get(key)
    if (existingDoc) { 
      collection.set(key, doc)
      writeResponse(undefined)
    } else {
      writeResponse(404) 
    }    
  })
}

exports.remove = function remove(collectionName, key, writeResponse) {
  log.debug("removing item " + collectionName + "/" + key)
  var collection = openCollection(collectionName)
  collection.rm(key)
  writeResponse()
}


/*
 * For write access only, use the (potentially faster) method openCollection.
 * For read access, use this method and pass a callback.
 */
function withCollectionDo(collectionName, callback) {
  _accessCollection(collectionName, callback)
}

/*
 * According to node-dirty docs you can safely write to the collection (db in
 * their terms) directly. To safely read from the collection, you need to wait
 * for the event 'load', however. See withCollectionDo.
 */
function openCollection(collectionName) {
  return _accessCollection(collectionName, undefined)
}

/* To be used only from withCollectionDo and openCollection */
function _accessCollection(collectionName, callback) {
  var name = getDatabaseFilename(collectionName)
  var collection = cache.get(name)
  if (collection) {
    log.debug('accessing collection ' + name + ' via cached collection object.') 
    if (callback) {
      callback(collection)
    }
    return collection
  } else {
    log.debug("collection " + collectionName + " was not in cache.")
    collection = dirty.Dirty(name)
    collection.on('load', function() {
      log.debug("collection " + collectionName + " created/loaded.")
      cache.put(name, collection)
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
