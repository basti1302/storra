'use strict'

var request = require('request')

var HttpStepsWrapper = function () {
  // this.World = require("../support/world.js").World // overwrite default World constructor

  var self = this

  this.When(/^I access the root URI$/, function(callback) {
    get("http://localhost:1302/", callback)
  })

  this.When(/^I access the root URI with the OPTIONS verb$/, function(callback) {
    options("http://localhost:1302/", callback)
  })
  
  this.Then(/^the http status should be (\d+)$/, function(status, callback) {
    if (!self.lastResponse) {
      callback.fail(new Error("No request has been made until now."))
    } else if (self.lastResponse.statusCode == status) {
      callback()
    } else {
      callback.fail("The last http response did not have the expected status, expected " + status + " but got " + self.lastResponse.status)
    }
  })

  this.Then(/^I should see "([^"]*)"$/, function(content, callback) {
    if (!self.lastResponse) {
      callback.fail(new Error("No request has been made until now."))
    } else if (!self.lastResponse.body) {
      callback.fail(new Error("The last request had no response body."))
    } else if (self.lastResponse.body.indexOf(content) > -1) {
      callback()
    } else {
      callback.fail("The last response did not have the expected content, expected\n\n" + this.lastResponse.body + "\nto contain\n\n" + content)
    }
  })

  this.Then(/^I should see no content$/, function(callback) {
    if (!self.lastResponse) {
      callback.fail(new Error("No request has been made until now."))
    } else if (self.lastResponse.body) {
      callback.fail(new Error("The last request had some content in the response body, I expected no content. Response body: \n\n" + self.lastResponse.body))
    } else {
      callback()
    }
  })

  function get(uri, callback) {
    request.get(uri, function(error, response, body) {
      if (error) {
        return callback.fail(new Error("Error on GET request to " + uri + ": " + error.message))
      }
      self.lastResponse = response
      callback()
    })
  }

  function options(uri, callback) {
    request({"uri": uri, method: "OPTIONS"}, function(error, response, body) {
      if (error) {
        return callback.fail(new Error("Error on OPTIONS request to " + uri + ": " + error.message))
      }
      self.lastResponse = response
      callback()
    })
  }
}

module.exports = HttpStepsWrapper
