'use strict'

var Step = require('step')

var HttpStepsWrapper = function () {

  this.World = require("../support/world.js").World

  /* GIVEN */

  this.Given(/^an empty collection$/, function(callback) {
    this.generateCollectionId()
    // currently, from the perspective of a storra client, there is no
    // difference between an empty and a non-existing collection
    callback()
  })

  this.Given(/^a non\-existing collection$/, function(callback) {
    this.generateCollectionId()
    // currently, from the perspective of a storra client, there is no
    // difference between an empty and a non-existing collection
    callback()
  })

  this.Given(/^a collection with documents$/, function(callback) {
    this.generateCollectionId()
    var world = this
    Step(
      function post1() {
        world.post(world.collectionPath(), '{"a": "b"}', this) 
      },
      function post2(err) {
        if (err) throw err
        world.post(world.collectionPath(), '{"c": "d"}', this) 
      },
      function callCallback(err) {
        if (err) throw err
        callback()
      }
    )
  })
 
  /* WHEN */

  this.When(/^I GET the root URI$/, function(callback) {
    this.get('/', callback)
  })

  this.When(/^I access the root URI with the OPTIONS verb$/, function(callback) {
    this.options('/', callback)
  })

  this.When(/^I GET the collection$/, function(callback) {
    this.get(this.collectionPath(), callback)
  })
 
  /* THEN */
  
  this.Then(/^the http status should be (\d+)$/, function(status, callback) {
    if (!assertResponse(this.lastResponse(), callback)) { return }
    if (this.lastResponse().statusCode != status) {
      callback.fail("The last http response did not have the expected status, expected " + status + " but got " + this.lastResponse().status)
    } else {
      callback()
    }
  })

  this.Then(/^I should see no content$/, function(callback) {
    if (!assertResponse(this.lastResponse(), callback)) { return }
    if (this.lastResponse().body) {
      callback.fail("The last request had some content in the response body, I expected no content. Response body: \n\n" + this.lastResponse().body)
    } else {
      callback()
    }
  })
 
  this.Then(/^I should see "([^"]*)"$/, function(content, callback) {
    if (!assertBodyContains(this.lastResponse(), content, callback)) { return } 
    callback()
  })


  this.Then(/^I should see an empty list of documents$/, function(callback) {
    if (!assertBodyIs(this.lastResponse(), '[]', callback)) { return }
    callback()
  })

  this.Then(/^I should see a list of documents$/, function(callback) {
    if (!assertBodyContains(this.lastResponse(), '{"a":"b","_id":"', callback)) { return }
    if (!assertBodyContains(this.lastResponse(), '{"c":"d","_id":"', callback)) { return }
    callback()
  })

  function assertResponse(lastResponse, callback) {
    if (!lastResponse) {
      callback.fail(new Error("No request has been made until now."))
      return false
    }
    return true
  }
 
  function assertBody(lastResponse, callback) {
    if (!assertResponse(lastResponse, callback)) { return false }
    if (!lastResponse.body) {
      callback.fail(new Error("The response to the last request had no body."))
      return false
    }
    return true
  }

  function assertBodyIs(lastResponse, expectedContent, callback) {
    if (!assertBody(lastResponse, callback)) { return }
    if (lastResponse.body !== expectedContent) {
      callback.fail("The last response did not have the expected content. Got:\n\n" + lastResponse.body + "\n\nExpected:\n\n" + expectedContent)
      return false
    }
    return true
  }

  function assertBodyContains(lastResponse, expectedContent, callback) {
    if (!assertBody(lastResponse, callback)) { return false }
    if (lastResponse.body.indexOf(expectedContent) === -1) {
      callback.fail("The last response did not have the expected content. Expected\n\n" + lastResponse.body + "\nto contain\n\n" + expectedContent)
      return false
    } 
    return true
  }
}

module.exports = HttpStepsWrapper
