'use strict';

/*
 * Wrapper for nStore.
 *
 * Accesses the in-memory database.
 */


var constants = require('constants')
var cache = new (require ('./collection_cache'))()
var log = require('../log')

function NStoreConnector() {

  var self = this

  this.init = function(configReader) {
    this.nStore = this.nStore.extend(require('nstore/query')())
  }

  this.checkAvailable = function(callbackAvailable, callbackNotAvailable) {
    callbackAvailable()
  }

  this.list = function list(collectionName, writeDocument, writeEnd) {
    log.debug('listing %s', collectionName)
    withCollectionDo(collectionName, function(collection) {
      collection.all(function(err, results) {
        if (err) {
          return writeEnd(err)
        } else {
          iterateThroughObject(results, writeDocument)
          return writeEnd(null)
        }
      })
    })
  }

  // Duplication: Same code as for node-dirty backend
  this.removeCollection = function(collectionName, writeResponse) {
    log.debug('removing collection %s', collectionName)

    // according to nstore docs the following should work, but clear
    // isn't even implemented.
    // Also see https://github.com/creationix/nstore/pull/40
    // collection.clear(function (err) {
    //  writeResponse(err)
    //})

    // For now, we just do a hard filesystem delete on the file.
    // Of course, this is bound to break on concurrent requests.
    var databaseFilename = getDatabaseFilename(collectionName)
    cache.remove(databaseFilename)
    this.fs.exists(databaseFilename, function (exists) {
      if (exists) {
        log.debug('file %s exists, needs to be unlinked', databaseFilename)
        // fs.unlink on windows behaves weird... often the file just stays there
        // although the unlink callback receives no err. This causes hard to
        // debug subsequent errors. Instead of deleting the file, we at least
        // truncate it. TODO: Also fix nstore backend like this.
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
            // TODO Use https://npmjs.org/package/errno-codes
            // to get rid of magic number 34.
            //
            // ignore error number 34/ENOENT, might happen if a concurrent
            // removeCollection alread killed the file
            if (err && err.errno && err.errno === 34) {
              log.warn('Ignoring: ', err)
              err = undefined
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

  this.read = function read(collectionName, key, writeResponse) {
    withCollectionDo(collectionName, function(collection) {
      log.debug('reading %s/%s', collectionName, key)
      collection.get(key, function (err, doc, key2) {
        if (err && err.message === 'Document does not exist for ' + key) {
          return writeResponse(create404(), null, key2)
        } else {
          doc._id = key2
          return writeResponse(err, doc, key2)
        }
      })
    })
  }

  this.create = function create(collectionName, doc, writeResponse) {
    log.debug('creating item in %s', collectionName)
    withCollectionDo(collectionName, function(collection) {
      collection.save(null, doc, function (err, key) {
        return writeResponse(err, key)
      })
    })
  }

  this.update = function update(collectionName, key, doc, writeResponse) {
    log.debug('updating item %s/%s', collectionName, key)
    withCollectionDo(collectionName, function(collection) {
      // call get to make sure the key exist, otherwise we need to 404
      collection.get(key, function (err) {
        // TODO Differentiate between 404 and other errors!
        if (err) {
          return writeResponse(create404())
        } else {
          collection.save(key, doc, function (err) {
            return writeResponse(err)
          })
        }
      })
    })
  }

  this.remove = function remove(collectionName, key, writeResponse) {
    log.debug('removing item %s/%s', collectionName, key)
    withCollectionDo(collectionName, function(collection) {
      collection.remove(key, function (err) {
        if (err && err.errno === constants.ENOENT) {
          log.debug('Not found: ' + key)
        } else if (err) {
          log.error(err.stack)
        }
        return writeResponse()
      })
    })
  }

  this.closeConnection = function closeConnection(callback) {
    log.debug('closeConnection has no effect with the nStore backend.')
    if (callback && typeof callback === 'function') {
      return callback(undefined)
    }
  }

  function withCollectionDo(collectionName, callback) {
    var databaseFilename = getDatabaseFilename(collectionName)
    var collection = cache.get(databaseFilename)
    if (collection) {
      log.debug('accessing collection %s via cached collection object.',
          databaseFilename)
      return callback(collection)
    } else {
      log.debug('collection %s was not in cache.', databaseFilename)
      collection = self.nStore.new(databaseFilename, function (err) {
        if (err) { throw err }
        log.debug('collection %s created/loaded.', collectionName)
        cache.put(databaseFilename, collection)
        return callback(collection)
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
      if (obj.hasOwnProperty(key)) {
        var doc = obj[key]
        doc._id = key
        cb(doc)
      }
    }
  }

  function create404() {
    var error = new Error('not found')
    error.httpStatus = 404
    return error
  }
}

module.exports = NStoreConnector
