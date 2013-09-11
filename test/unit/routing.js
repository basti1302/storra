var chai = require('chai')
chai.should()
var expect = chai.expect
var sinon = require('sinon')

describe('router#', function() {

  var requesthandler
  var router

  beforeEach(function() {
    requesthandler = {}
    requesthandler.root = sinon.spy()
    requesthandler.options = sinon.spy()
    requesthandler.create = sinon.spy()
    requesthandler.list = sinon.spy()
    requesthandler.removeCollection = sinon.spy()
    requesthandler.retrieve = sinon.spy()
    requesthandler.update = sinon.spy()
    requesthandler.remove = sinon.spy()
    requesthandler.notFound = sinon.spy()
    requesthandler.notImplemented = sinon.spy()

    var Router = require('../../lib/router')
    router = new Router()
    router.requesthandler = requesthandler
    router.initRoutes()
  })

  it('GET / is routed to root', function() {
    router.route(get('http://localhost/'))
    requesthandler.root.should.have.been.called
  })

  it('POST / is routed to 503 Not Implemented', function() {
    router.route(post('http://localhost/'))
    requesthandler.notImplemented.should.have.been.called
  })

  it('GET /favicon.ico is routed to 404 Not Found', function() {
    router.route(get('http://localhost/favicon.ico'))
    requesthandler.notFound.should.have.been.called
  })

  it('OPTIONS for any URL are routed to the options handler', function() {
    router.route(options('http://localhost/'))
    requesthandler.options.should.have.been.called
    router.route(options('http://localhost/collection'))
    requesthandler.options.should.have.been.called
    router.route(options('http://localhost/collection/key'))
    requesthandler.options.should.have.been.called
  })

  it('GET /collection lists a collection', function() {
    router.route(get('http://localhost/collection'))
    requesthandler.list.should.have.been.called
  })

  it('POST /collection creates a new document', function() {
    router.route(post('http://localhost/collection'))
    requesthandler.create.should.have.been.called
  })

  it('DELETE /collection deletes a collection', function() {
    router.route(remove('http://localhost/collection'))
    requesthandler.removeCollection.should.have.been.called
  })

  it('GET /collection/key retrieves a document', function() {
    router.route(get('http://localhost/collection/key'))
    requesthandler.retrieve.should.have.been.called
  })

  it('PUT /collection/key updates a document', function() {
    router.route(put('http://localhost/collection/key'))
    requesthandler.update.should.have.been.called
  })

  it('DELETE /collection/key removes a document', function() {
    router.route(remove('http://localhost/collection/key'))
    requesthandler.remove.should.have.been.called
  })

  var request = function(url, method) {
    return {
      url: url,
      method: method
    }
  }

  var get = function(url) {
    return request(url, 'GET')
  }

  var post = function (url) {
    return request(url, 'POST')
  }

  var put = function (url) {
    return request(url, 'PUT')
  }

  var remove = function (url) {
    return request(url, 'DELETE')
  }

  var options = function (url) {
    return request(url, 'OPTIONS')
  }
})
