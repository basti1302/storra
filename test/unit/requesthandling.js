var chai = require('chai')
var expect = chai.expect
var sinon = require('sinon')
var sinonChai = require('sinon-chai')
chai.use(sinonChai)

describe('The request handler', function() {

  var backend = null
  var requesthandler = null
  var request = null
  var response = null
  var err404 = new Error("not found")
  err404.httpStatus = 404

  beforeEach(function() {
    var RequestHandler = require('../../lib/requesthandler')
    requesthandler = new RequestHandler()

    backend = {}
    backend.init = sinon.spy()
    backend.list = sinon.stub()
    backend.removeCollection = sinon.spy()
    backend.read = sinon.spy()
    backend.create = sinon.spy()
    backend.update = sinon.spy()
    backend.remove = sinon.spy()
    requesthandler.backend = backend

    request = {}
    request.on = sinon.spy()
    request.once = sinon.spy()
    request.removeAllListeners = sinon.spy()
    request.headers = {host: 'localhost'}
    request.url = 'http://localhost:8888'

    response = {}
    response.writeHead = sinon.spy()
    response.write = sinon.spy()
    response.end = sinon.spy()
  })

  it('responds to root with 400 Bad Request', function() {
    requesthandler.root(request, response)
    expectResponse(400)
    expectContent()
  })

  it('handles OPTIONS requests', function() {
    requesthandler.options(request, response)
    expectResponse(200)
    // OPTIONS response has no body
    expectNoContent()
  })

  it('serves a collection of documents', function(done) {
    // TODO Strange, if we stub-call both callbacks, the second is not called?
    // backend.list.callsArgWith(1, [])
    backend.list.callsArgWithAsync(2, null)
    requesthandler.list(request, response, 'collection')

    waitFor(
      function() { return response.end.called },
      function() {
        expect(backend.list).to.have.been.calledWith('collection',
          sinon.match.func, sinon.match.func)
        expectResponse(200)
        expectContent()
        done()
      }
    )
  })

  it.only('says 500 if listing the collection fails', function() {
    backend.list.callsArgWith(2, new Error('test error'))
    requesthandler.list(request, response, 'collection')
    expect500()
  })

  /*
  it('removes a collection', function() {
    requesthandler.removeCollection(request, response, 'collection')
    expect(backend.removeCollection).toHaveBeenCalledWith 'collection',
        jasmine.any(Function)
    whenCallback(backend.removeCollection, 1).thenCallIt(requesthandler,
        undefined)
    expectResponse(204)
    expectNoContent()
  })

  it('says 500 if removing a collection fails', function() {
    requesthandler.removeCollection(request, response, 'collection')
    expect(backend.removeCollection).toHaveBeenCalledWith 'collection',
        jasmine.any(Function)
    whenCallback(backend.removeCollection, 1).thenCallIt(requesthandler,
        new Error('test error'))
    expect500()
  })

  it('serves a document', function() {
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(backend.read, 2).thenCallIt(requesthandler, undefined,
        {foo: 'bar', _id: 'key'}, 'key')
    expectResponse(200)
    expectContent('{"foo":"bar","_id":"key"}')
  })

  it('says 404 if serving a document fails', function() {
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(backend.read, 2).thenCallIt(requesthandler, err404, null,
        'key')
    expect404()
  })

  it('says 500 if serving a document fails for unknown reasons', function() {
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(backend.read, 2).thenCallIt(
      requesthandler, new Error('test error'), {}, 'key')
    expect500()
  })

  it('creates a document', function() {
    requesthandler.create(request, response, 'collection')
    stubCreateUpdate()
    expect(backend.create).toHaveBeenCalled()
    whenCallback(backend.create, 2).thenCallIt(requesthandler, undefined, 'key')
    // We only care about the location header here. But Jasmine is a bit stubborn
    // and without argument captors, it's not so easy to verify just this one
    // header.
    expectResponseAndHeaders(201, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "X-Requested-With,
 Access-Control-Allow-Origin, X-HTTP-Method-Override, Content-Type,
 Authorization, Accept",
      "access-control-allow-methods": "POST, GET, PUT, DELETE, OPTIONS",
      "access-control-allow-credentials": true,
      "access-control-max-age": "86400",
      "location" : "http://localhost/key",
      "x-storra-entity-key" : "key"
    })
    expectNoContent()
  })

  it('says 500 if creating a document fails', function() {
    requesthandler.create(request, response, 'collection')
    stubCreateUpdate()
    whenCallback(backend.create, 2).thenCallIt(
      requesthandler, new Error('test error'), 'key')
    expect500()
  })

  it('updates a document', function() {
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    expect(backend.update).toHaveBeenCalled()
    whenCallback(backend.update, 3).thenCallIt(requesthandler, undefined)
    expectResponse(204)
    expectNoContent()
  })

  it('says 404 if the document is not found during update', function() {
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    whenCallback(backend.update, 3).thenCallIt(requesthandler, err404)
    expect404()
  })

  it('says 500 if updating a document fails', function() {
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    whenCallback(backend.update, 3).thenCallIt(
      requesthandler, new Error('test error'))
    expect500()
  })

  it('deletes a document', function() {
    requesthandler.remove(request, response, 'collection', 'key')
    whenCallback(backend.remove, 2).thenCallIt(requesthandler, undefined)
    expectResponse(204)
    expectNoContent()
  })

  it('says 500 if deleting  a document fails', function() {
    requesthandler.remove(request, response, 'collection', 'key')
    whenCallback(backend.remove, 2).thenCallIt(
      requesthandler, new Error('test error'))
    expect500()
  })

  it('handles bad requests', function() {
    requesthandler.badRequest(response, "some very informational text")
    expectResponse(400)
    expectContent('I\'m unable to process this request. I\'m terribly sorry.',
        '\nAdditional info: some very informational text')
  })

  it('handles not found errors', function() {
    requesthandler.notFound(response)
    expect404()
  })

  it('handles internal server errors', function() {
    requesthandler.internalServerError(response)
    expect500()
  })

  it('handles unimplemented methods', function() {
    requesthandler.notImplemented(response)
    expectResponse(501)
    expectNoContent()
  })

  */

  expectResponse = function(status) {
    response.writeHead.should.have.been.calledWith(status, sinon.match.object)
  }

  /*
  expectResponseAndHeaders = (status, headers) ->
    expect(response.writeHead).toHaveBeenCalledWith(status, headers)
  */

  expectContent = function() {
    if (arguments.length > 0) {
      for (var string in arguments) {
        response.write.should.have.been.calledWith(string)
      }
    } else {
      response.write.should.have.been.called
    }
    response.end.should.have.been.called
  }

  expectNoContent = function() {
    response.write.should.not.have.been.called
    response.end.should.have.been.called
  }

  expect404 = function() {
    expectResponse(404)
    expectContent('The requested resource was not found. ')
  }

  expect500 = function() {
    expectResponse(500)
    expectContent('Oops, something went wrong.')
  }

  /*
  stubCreateUpdate = () ->
    requestReaderOnData = request.on.calls[0].args[1]
    requestReaderOnEnd = request.once.calls[0].args[1]
    requestReaderOnData.call(requesthandler, '{"foo":"bar"}')
    requestReaderOnEnd.call(requesthandler)
  */

  waitFor = function(test, onSuccess, polling) {
    if (polling == null || polling == undefined) {
      polling = 10
    }
    var handle = setInterval(function() {
      clearInterval(handle)
      if (test()) {
        onSuccess()
      }
    }, polling)
  }
})
