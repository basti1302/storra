'use strict'

var http = require('http')

var HttpStepsWrapper = function () {
  // this.World = require("../support/world.js").World // overwrite default World constructor

  this.lastResponse = null

  this.When(/^I access the root URI$/, function(callback) {
    this.lastResponse = new SavedResponse()
    httpGet("http://localhost:1302/", this.lastResponse, callback)
  })

  this.Then(/^the http status should be (\d+)$/, function(status, callback) {
    if (!this.lastResponse) {
      callback.fail(new Error("No request has been made until now."))
    } else if (this.lastResponse.status == status) {
      callback()
    } else {
      callback.fail("The last request did not have the expected status, expected " + status + " but got " + this.lastResponse.status)
    }
  })

  this.Then(/^I should see "([^"]*)"$/, function(content, callback) {
    if (!this.lastResponse || !this.lastResponse.body) {
      callback.fail(new Error("No request has been made until now made or the last request had no response body"))
    } else if (this.lastResponse.body.indexOf(content) > -1) {
      callback()
    } else {
      callback.fail("The last request did not have the expected content, expected\n\n" + this.lastResponse.body + "\nto contain\n\n" + content)
    }
  })

  function httpGet(uri, lastResponse, callback) {
    http.get(uri, function(res) {
      lastResponse.status = res.statusCode
      res.setEncoding('utf8')
      res.on('data', function (chunk) {
        lastResponse.appendToBody(chunk)
      })
      res.on('end', function() {
        callback()
      })
    }).on('error', function(e) {
      console.log("Error on request to " + uri + ": " + e.message)
      callback.fail(new Error("Error on request to " + uri + ": " + e.message))
    })
  }

  function SavedResponse() {
    this.status = null
    this.body = null
    this.appendToBody = function appendToBody(chunk) {
      if (!this.body) {
        this.body = ''
      }
      this.body += chunk
    }
  }
}

module.exports = HttpStepsWrapper
