var request = require('request')
var uuid = require('node-uuid')

var env = require('./env')

var World = function World(callback) {

  var collection = null
  var res = null

  this.generateCollectionId = function() {
    collection = uuid.v1()
  }

  this.get = function(path, callback) {
    request.get(uri(path), function(error, response, body) {
      if (error) {
        return callback.fail(new Error("Error on GET request to " + uri(path) + ": " + error.message))
      }
      res = response
      callback()
    })
  }

  this.post = function(path, requestBody, callback) {
    request({url: uri(path), body: requestBody, method: 'POST'}, function(error, response, responseBody) {
      if (error) {
        return callback(new Error("Error on POST request to " + uri(path) + ": " + error.message))
      }
      else if (response.statusCode != 201) {
        return callback(new Error("Not 201 on POST request to " + uri(path) + ": " + response.statusCode))
      }
      res = response
      callback(null)
    })
  }

  this.options = function(path, callback) {
    request({"uri": uri(path), method: "OPTIONS"}, function(error, response, body) {
      if (error) {
        return callback.fail(new Error("Error on OPTIONS request to " + uri(path) + ": " + error.message))
      }
      res = response
      callback()
    })
  }

  this.lastResponse = function() {
    return res
  }

  this.collectionPath = function() {
    return '/' + collection
  }

  function uri(path) {
    return env.BASE_URL + path
  }


  callback()
}

exports.World = World
