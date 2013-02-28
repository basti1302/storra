'use strict'

/*
 * Wrapper for {database}.
 */

var log = require('../log')
var MongoClient = require('mongodb').MongoClient
var Server = require('mongodb').Server
var mongoClient = new MongoClient(new Server('localhost', 27017));
// TODO Needs to be parameterizable from outside (yaml)
var database = 'storra'
  
// TODO Refactor the connection opening into a method of its own
// TODO Cache mongodb connections - how to close them properly when
// evicting from cache and when node exits?

// TODO How to handle _id of the objects read from MongoDB?
// Touch each object and replace _id with storra_key?
// That's probably quite expensive. But OTOH we want to present a
// somewhat uniform interface and hide the backend specialties.
// Maybe we should go with _id all the way. It seems that at least MongoDB and CouchDB agree on this.
// Whatever we do, we need to reflect it in the tests, e. g., backend_integration.spec.coffee
exports.list = function list(collectionName, writeResponse) {
  log.debug("listing " + collectionName)
  mongoClient.open(function(err, mongoClient) {
    var db = mongoClient.db(database)
 
    // TODO: Change contract between requesthandler and backend to use array instead of object!
    // requesthandler converts the object returned here into an array again. WTF?!?!?!?

    // TODO: We need chunking/streaming here, to write back large result sets back to the
    // response in chunks, probably calling ourselves recursivly per process.nextTick to allow
    // other requests to be handled in between the chunks, otherwise the listing of large collections
    // block here. This also influences how requesthandler writes the response. requesthandler
    // probably needs to pass in a writeChunk callback and an end callback. Or we need to emit
    // events here. Also, check other backends.

    var results = {}
    db.collection(collectionName).find().each(function(err, doc) {
      if (err) {
        mongoClient.close()
        writeResponse(err, null)
      } else if (doc) {
        log.debug("listing entry: " + JSON.stringify(doc))
        results[doc['_id']] = doc
      } else {
        // db cursor exhausted, no more results -> write response
        mongoClient.close()
        writeResponse(err, results)
      }
    })
  })
}

exports.removeCollection = function removeCollection(collectionName, writeResponse) {
  log.debug("removing collection " + collectionName)
  mongoClient.open(function(err, mongoClient) {
    var db = mongoClient.db(database)
     db.collection(collectionName).drop(function(err, result) {
      mongoClient.close()
      writeResponse(err)
    })
  })
}

exports.read = function read(collectionName, key, writeResponse) {
  log.debug("reading item " + collectionName + "/" + key)
  mongoClient.open(function(err, mongoClient) {
    var db = mongoClient.db(database)
    db.collection(collectionName).findOne({_id: key}, function(err, doc) {
      mongoClient.close()
      if (doc) {
        writeResponse(err, doc, key)
      } else {
        writeResponse(404, null, key)
      }
    })
  })
}

exports.create = function create(collectionName, doc, writeResponse) {
  log.debug("creating item in " + collectionName)
  mongoClient.open(function(err, mongoClient) {
    var db = mongoClient.db(database)
    db.collection(collectionName).insert(doc, {}, function(err, result) {
      mongoClient.close()
      if (result) {
        writeResponse(err, result[0]['_id'])
      } else {
        writeResponse(err, undefined)
      } 
    })
  })
}

exports.update = function update(collectionName, key, doc, writeResponse) {
  log.debug("updating item " + collectionName + "/" + key)
  mongoClient.open(function(err, mongoClient) {
    var db = mongoClient.db(database)
    db.collection(collectionName).update({_id: key}, doc, {}, function(err, result) {
      mongoClient.close()
      writeResponse(err)
    })
  })
}

exports.remove = function remove(collectionName, key, writeResponse) {
  log.debug("removing item " + collectionName + "/" + key)
  mongoClient.open(function(err, mongoClient) {
    var db = mongoClient.db(database)
    db.collection(collectionName).remove({_id: key}, function(err, numberOfRemovedDocs) {
      log.debug("Removed " + numberOfRemovedDocs + " documents")
      mongoClient.close()
      writeResponse(err)
    })
  })
}
