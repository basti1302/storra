'use strict'

/*
 * Wrapper for nStore.
 * 
 * Accesses the in-memory database.
 */

var fs = require('fs');
var nStore = require('nstore')
nStore = nStore.extend(require('nstore/query')())

var log = require('../log')

exports.list = function list(collectionName, writeResponse) {
  log.debug("listing " + collectionName)
  withCollectionDo(collectionName, function(collection) {
    collection.all(function(err, results) {
      writeResponse(err, results)
    })
  })  
}

exports.removeCollection = function removeCollection(collectionName, writeResponse) {
  log.debug("removing collection " + collectionName)

  // according to nstore docs the following should work, but clear
  // isn't even implemented. WTF?
  // collection.clear(function (err) {
  //  writeResponse(err)
  //})

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
    collection.get(key, function (err, doc, key) {
      writeResponse(err, doc, key)
    })
  })
}

exports.create = function create(collectionName, doc, writeResponse) {
  log.debug("creating item in " + collectionName)
  withCollectionDo(collectionName, function(collection) {
    collection.save(null, doc, function (err, key) {
      writeResponse(err, key)
    })
  })
}

exports.update = function update(collectionName, key, doc, writeResponse) {
  log.debug("updating item " + collectionName + "/" + key)
  withCollectionDo(collectionName, function(collection) {
    // call get to make sure the key exist, otherwise we need to 404
    collection.get(key, function (err) {
      // TODO Differentiate between 404 and other errors!
      if (err) { 
        writeResponse(404) 
      } else {
        collection.save(key, doc, function (err) {
          writeResponse(err)
        })    
      }
    })
  })
}

exports.remove = function remove(collectionName, key, writeResponse) {
  log.debug("removing item " + collectionName + "/" + key)
  withCollectionDo(collectionName, function(collection) {
    collection.remove(key, function (err) {
      if (err) { log.error(err.stack) }
      writeResponse()
    })
  })
}


function withCollectionDo(collectionName, callback) {
  // TODO Each db operation loads the collection from the file system. This sucks.
  // We need to cache the open collections, otherwise we abuse the in-memory database as a file system database.
  var collection = nStore.new(getDatabaseFilename(collectionName), function (err) {
    if (err) { throw err }
    /* (too chatty)  log.debug("collection " + collectionName + " created/loaded") */
    callback(collection)
  })
}

function getDatabaseFilename(collectionName) {
  return 'data/' + collectionName + '.nstore.db'
}
