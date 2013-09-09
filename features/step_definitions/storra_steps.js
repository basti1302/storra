'use strict';

var url = require('url')
var Step = require('step')

var HttpStepsWrapper = function () {

  this.World = require('../support/world.js').World

  this.expectedDocumentContent = null

  /* GIVEN */

  this.Given(/^an empty collection$/, function(callback) {
    this.generateCollectionId()
    var world = this
    /* jshint -W064 */
    Step(
      function post() {
        world.post(world.rootPath(),
          '{"name": "' + world.collection + '"}', this)
      },
      function callCallback(err, location) {
        if (err) throw err
        callback()
      }
    )
    /* jshint +W064 */
  })

  this.Given(/^a non\-existing collection$/, function(callback) {
    this.generateCollectionId()
    callback()
  })

  this.Given(/^a non\-existing document$/, function(callback) {
    this.generateDocumentId()
    callback()
  })

  this.Given(/^a collection with a document$/, function(callback) {
    var world = this
    this.generateCollectionId()
    /* jshint -W064 */
    Step(
      function post() {
        world.post(world.collectionPath(world.collection), '{"a": "b"}', this)
      },
      function callCallback(err, location) {
        if (err) throw err
        world.doc1 = lastPathElement(location)
        world.doc2 = null
        world.expectedDocumentContent = '{"a":"b","_id":"'
        callback()
      }
    )
    /* jshint +W064 */
  })

  this.Given(/^a collection with documents$/, function(callback) {
    var world = this
    this.generateCollectionId()
    /* jshint -W064 */
    Step(
      function post1() {
        world.post(world.collectionPath(world.collection), '{"a": "b"}', this)
      },
      function post2(err, location) {
        if (err) { throw err }
        world.doc1 = lastPathElement(location)
        world.post(world.collectionPath(world.collection), '{"c": "d"}', this)
      },
      function callCallback(err, location) {
        if (err) throw err
        world.doc2 = lastPathElement(location)
        callback()
      }
    )
    /* jshint +W064 */
  })

  /* WHEN */

  this.When(/^I GET the root URI$/, function(callback) {
    this.get(this.rootPath(), callback)
  })

  this.When(/^I access the root URI with the OPTIONS verb$/,
      function(callback) {
    this.options(this.rootPath(), callback)
  })

  this.When(/^I GET the collection$/, function(callback) {
    this.get(this.collectionPath(this.collection), callback)
  })

  this.When(/^I DELETE the collection$/, function(callback) {
    this.delete(this.collectionPath(this.collection), callback)
  })

  this.When(/^I GET the document$/, function(callback) {
    this.get(this.documentPath(this.collection, this.doc1), callback)
  })

  this.When(/^I POST a document$/, function(callback) {
    var world = this
    /* jshint -W064 */
    Step(
      function post() {
        world.post(world.collectionPath(world.collection), '{"x": "y"}', this)
      },
      function callCallback(err, location) {
        if (err) { throw err }
        world.doc1 = lastPathElement(location)
        world.doc2 = null
        world.expectedDocumentContent = '{"x":"y","_id":"'
        callback()
      }
    )
    /* jshint +W064 */
  })

  this.When(/^I PUT the document$/, function(callback) {
    var world = this
    /* jshint -W064 */
    Step(
      function put() {
        world.put(world.documentPath(world.collection, world.doc1),
          '{"Storra": "rocks!"}', this)
      },
      function callCallback(err) {
        if (err) { throw err }
        world.expectedDocumentContent = '{"Storra":"rocks!","_id":"'
        callback()
      }
    )
    /* jshint +W064 */
  })

  this.When(/^I DELETE the document$/, function(callback) {
    this.delete(this.documentPath(this.collection, this.doc1), callback)
  })

  /* THEN */

  this.Then(/^the http status should be (\d+)$/, function(status, callback) {
    if (!assertResponse(this.lastResponse, callback)) { return }
    // deliberately using != here (no need to cast integer/string)
    /* jshint -W116 */
    if (this.lastResponse.statusCode != status) {
    /* jshint +W116 */
      callback.fail('The last http response did not have the expected ' +
        'status, expected ' + status + ' but got ' +
        this.lastResponse.statusCode)
    } else {
      callback()
    }
  })

  this.Then(/^I should see no content$/, function(callback) {
    if (!assertResponse(this.lastResponse, callback)) { return }
    if (this.lastResponse.body) {
      callback.fail('The last request had some content in the response body, ' +
        'I expected no content. Response body: \n\n' + this.lastResponse.body)
    } else {
      callback()
    }
  })

  this.Then(/^I should see "([^"]*)"$/, function(content, callback) {
    if (!assertBodyContains(this.lastResponse, content, callback)) { return }
    callback()
  })

  this.Then(/^I should see an empty list of documents$/, function(callback) {
    if (!assertBodyIs(this.lastResponse, '[]', callback)) { return }
    callback()
  })

  this.Then(/^I should see a list of documents$/, function(callback) {
    if (!assertBodyContains(this.lastResponse, '{"a":"b","_id":"', callback)) {
      return
    }
    if (!assertBodyContains(this.lastResponse, '{"c":"d","_id":"', callback)) {
      return
    }
    callback()
  })

  this.Then(/^I should see the document$/, function(callback) {
    if (!assertBodyContains(this.lastResponse, this.expectedDocumentContent,
        callback)) {
      return
    }
    callback()
  })


  function assertResponse(lastResponse, callback) {
    if (!lastResponse) {
      callback.fail(new Error('No request has been made until now.'))
      return false
    }
    return true
  }

  function assertBody(lastResponse, callback) {
    if (!assertResponse(lastResponse, callback)) { return false }
    if (!lastResponse.body) {
      callback.fail(new Error('The response to the last request had no body.'))
      return false
    }
    return true
  }

  function assertBodyIs(lastResponse, expectedContent, callback) {
    if (!assertBody(lastResponse, callback)) { return }
    if (lastResponse.body !== expectedContent) {
      callback.fail('The last response did not have the expected content. ' +
        'Got:\n\n' + lastResponse.body + '\n\nExpected:\n\n' + expectedContent)
      return false
    }
    return true
  }

  function assertBodyContains(lastResponse, expectedContent, callback) {
    if (!assertBody(lastResponse, callback)) { return false }
    if (lastResponse.body.indexOf(expectedContent) === -1) {
      callback.fail('The last response did not have the expected content. ' +
        'Expected\n\n' + lastResponse.body + '\nto contain\n\n' +
        expectedContent)
      return false
    }
    return true
  }

  function lastPathElement(uri) {
    var path = url.parse(uri).pathname
    return path.slice(path.lastIndexOf('/') + 1)
  }
}

module.exports = HttpStepsWrapper
