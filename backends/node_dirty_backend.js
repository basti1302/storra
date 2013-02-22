'use strict'

/*
 * Wrapper for node-dirty.
 * 
 * Accesses the in-memory database.
 */

var fs = require('fs');
var dirty = require('dirty')
var log = require('../log')
var uuid = require('node-uuid')

exports.list = function list(collectionName, writeResponse) {
  log.debug("listing " + collectionName)
  withCollectionDo(collectionName, function(collection) {
    var results = {}
    collection.forEach(function(key, doc) {
      log.debug("Entry: " + key + "; value: " + doc)
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
  var collection = openCollection(collectionName)
  collection.on('load', function() {
    log.debug("collection " + collectionName + " created/loaded")
    callback(collection)
  })
}

/*
 * According to node-dirty docs you can safely write to the collection (db in
 * their terms) directly. To safely read from the collection, you need to wait
 * for the event 'load', however. See withCollectionDo.
 */
function openCollection(collectionName) {
  // TODO Each db operation loads the collection from the file system. This sucks.
  // We need to cache the open collections, otherwise we abuse the in-memory database as a file system database.
  return dirty.Dirty(getDatabaseFilename(collectionName))
}

function getDatabaseFilename(collectionName) {
  return 'data/' + collectionName + '.node-dirty.db'
}
