'use strict';

var request = require('request')
var uuid = require('node-uuid')

var env = require('./env')

var World = function World(callback) {

  var self = this

  this.collection = null
  this.lastResponse = null
  this.doc1 = null
  this.doc2 = null

  this.generateCollectionId = function() {
    this.collection = uuid.v1()
  }

  this.generateDocumentId = function() {
    // MongoDB either accepts a 12 byte string or 24 hex characters
    this.doc1 = uuid.v1().replace(/-/gi, '').substring(0,24)
  }

  this.get = function(path, callback) {
    var uri = this.uri(path)
    request.get(uri, function(error, response) {
      if (error) {
        return callback.fail(new Error('Error on GET request to ' + uri +
          ': ' + error.message))
      }
      self.lastResponse = response
      callback()
    })
  }

  this.post = function(path, requestBody, callback) {
    var uri = this.uri(path)
    request({url: uri, body: requestBody, method: 'POST'},
        function(error, response) {
      if (error) {
        return callback(new Error('Error on POST request to ' + uri + ': ' +
          error.message))
      }
      self.lastResponse = response
      callback(null, self.lastResponse.headers.location)
    })
  }

  this.put = function(path, requestBody, callback) {
    var uri = this.uri(path)
    request({url: uri, body: requestBody, method: 'PUT'},
        function(error, response) {
      if (error) {
        return callback(new Error('Error on PUT request to ' + uri + ': ' +
            error.message))
      }
      self.lastResponse = response
      callback(null, self.lastResponse.headers.locations)
    })
  }

  this.delete = function(path, callback) {
    var uri = this.uri(path)
    request({url: uri, method: 'DELETE'},
        function(error, response) {
      if (error) {
        return callback(new Error('Error on DELETE request to ' + uri + ': ' +
            error.message))
      }
      self.lastResponse = response
      callback()
    })
  }

  this.options = function(path, callback) {
    var uri = this.uri(path)
    request({'uri': uri, method: 'OPTIONS'}, function(error, response) {
      if (error) {
        return callback.fail(new Error('Error on OPTIONS request to ' + uri +
            ': ' + error.message))
      }
      self.lastResponse = response
      callback()
    })
  }

  this.rootPath = function() {
    return '/'
  }

  this.rootUri = function() {
    return this.uri(this.rootPath())
  }

  this.collectionPath = function(collection) {
    return '/' + collection
  }

  this.collectionUri = function(collection) {
    return this.uri(this.collectionPath(collection))
  }

  this.documentPath = function(collection, document) {
    return this.collectionPath(collection) + '/' + document
  }

  this.documentUri = function(collection, document) {
    return this.uri(this.documentPath(collection, document))
  }

  this.uri = function(path) {
    return env.BASE_URL + path
  }

  callback()
}

exports.World = World
