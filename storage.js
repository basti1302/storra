'use strict'

/*
 * Wrapper for nStore.
 * 
 * Accesses the in-memory database.
 */

var nStore = require('nstore')
nStore = nStore.extend(require('nstore/query')())

var log = require('./log')

function list(collectionName, writeResponse) {
  log.debug("listing " + collectionName)
  inCollectionDo(collectionName, function(collection) {
    collection.all(function(err, results) {
      writeResponse(err, results)
    })
  })  
}

function read(collectionName, key, writeResponse) {
  inCollectionDo(collectionName, function(collection) {
    log.debug("reading " + collectionName + "/" + key)
    collection.get(key, function (err, doc, key) {
      writeResponse(err, doc, key)
    })
  })
}

function create(collectionName, doc, writeResponse) {
  log.debug("creating item in " + collectionName)
  inCollectionDo(collectionName, function(collection) {
    collection.save(null, doc, function (err, key) {
      writeResponse(err, key)
    })
  })
}

function update(collectionName, key, doc, writeResponse) {
  log.debug("updating item " + collectionName + "/" + key)
  inCollectionDo(collectionName, function(collection) {
    // call get to make sure the key exist, otherwise we need to 404
    collection.get(key, function (err) {
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

function remove(collectionName, key, writeResponse) {
  log.debug("removing item " + collectionName + "/" + key)
  inCollectionDo(collectionName, function(collection) {
    collection.remove(key, function (err) {
      if (err) { log.error(err.stack) }
      writeResponse()
    })
  })
}


function inCollectionDo(collectionName, callback) {
  var collection = nStore.new('data/' + collectionName + '.db', function (err) {
    if (err) { throw err }
    /* (too chatty)  log.debug("collection " + collectionName + " created/loaded") */
    callback(collection)
  })
}

exports.list = list
exports.read = read
exports.create = create
exports.update = update
exports.remove = remove
