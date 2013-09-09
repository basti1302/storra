'use strict';

/*
 * Wrapper for nStore.
 *
 * Accesses the in-memory database.
 */


var constants = require('constants')
var errors = require ('errno-codes')

var log = require('../log')

function NStoreConnector() {

  var self = this
  this.cache = new (require ('./collection_cache'))()

  this.init = function(configReader) {
    this.nStore = this.nStore.extend(require('nstore/query')())
  }

  this.checkAvailable = function(callbackAvailable, callbackNotAvailable) {
    callbackAvailable()
  }

  this.list = function list(collectionName, writeDocument, writeEnd) {
    log.debug('listing %s', collectionName)
    var databaseFilename = getDatabaseFilename(collectionName)
    this.fs.exists(databaseFilename, function (exists) {
      if (exists) {
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
      } else {
        return writeEnd(create404())
      }
    })
  }

  // Duplication: Same code as for node-dirty backend
  this.createCollection = function(collectionName, writeResponse) {
    log.debug('creating collection %s', collectionName)
    var databaseFilename = getDatabaseFilename(collectionName)
    this.fs.exists(databaseFilename, function (exists) {
      if (!exists) {
        // open file for writing to create it...
        self.fs.open(databaseFilename, 'wx', function (err, fd) {
          if (err) {
            writeResponse(err)
          }
          // ...then close it immediately again.
          self.fs.close(fd, function (err) {
            if (err) {
              writeResponse(err)
            }
            return writeResponse(null)
          })
        })
      } else {
        return writeResponse(create409('collection', collectionName))
      }
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
            if (err && err.errno && err.errno === errors.ENOENT.errno) {
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
    log.debug('reading %s/%s', collectionName, key)
    var databaseFilename = getDatabaseFilename(collectionName)
    this.fs.exists(databaseFilename, function (exists) {
      if (exists) {
        withCollectionDo(collectionName, function(collection) {
          collection.get(key, function (err, doc, key2) {
            if (err && err.errno === constants.ENOENT) {
              log.debug('not found: %s/%s', collectionName, key)
              return writeResponse(create404(), null, key2)
            } else if (err) {
              log.error(err)
              return writeResponse(err, null, key2)
            } else {
              log.debug('read result %s', JSON.stringify(doc))
              doc._id = key2
              return writeResponse(err, doc, key2)
            }
          })
        })
      } else {
        return writeResponse(create404(), null, key)
      }
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
    var databaseFilename = getDatabaseFilename(collectionName)
    this.fs.exists(databaseFilename, function (exists) {
      if (exists) {
        withCollectionDo(collectionName, function(collection) {
          // call get to make sure the key exist, otherwise we need to 404
          collection.get(key, function (err) {
            if (err && err.errno === constants.ENOENT) {
              return writeResponse(create404())
            } else if (err) {
              return writeResponse(err)
            } else {
              collection.save(key, doc, function (err) {
                return writeResponse(err)
              })
            }
          })
        })
      } else {
        return writeResponse(create404())
      }
    })
  }

  this.remove = function remove(collectionName, key, writeResponse) {
    log.debug('removing item %s/%s', collectionName, key)
    var databaseFilename = getDatabaseFilename(collectionName)
    this.fs.exists(databaseFilename, function (exists) {
      if (exists) {
        withCollectionDo(collectionName, function(collection) {
          collection.remove(key, function (err) {
            if (err && err.errno === constants.ENOENT) {
              // if the document does not exist we do not return an error -
              // because idempotence, y'know.
              log.debug('Not found: ' + key)
              return writeResponse(null)
            } else if (err) {
              log.error(err.stack)
              return writeResponse(err)
            } else {
              return writeResponse(null)
            }
          })
        })
      } else {
        // if the collection does not even exist (and thus the document also
        // does not exist), we also do not return an error - again, because
        // idempotence, y'know.
        return writeResponse(null)
      }
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
    var collection = self.cache.get(databaseFilename)
    if (collection) {
      log.debug('accessing collection %s via cached collection object.',
          databaseFilename)
      return callback(collection)
    } else {
      log.debug('collection %s was not in cache.', databaseFilename)
      collection = self.nStore.new(databaseFilename, function (err) {
        if (err) { throw err }
        log.debug('collection %s created/loaded.', collectionName)
        self.cache.put(databaseFilename, collection)
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

  function create409(type, name) {
    var error = new Error(type + ' already exists: ' + name)
    error.httpStatus = 409
    return error
  }
}

module.exports = NStoreConnector
