describe "The request handler", ->

  backend = null
  requesthandler = null
  request = null
  response = null
  err404 = new Error("not found")
  err404.httpStatus = 404

  beforeEach ->
    RequestHandler = require('../../lib/requesthandler')
    requesthandler = new RequestHandler()

    backend = jasmine.createSpyObj('backend', [
      'init'
      'list'
      'removeCollection'
      'read'
      'create'
      'update'
      'remove'
    ])
    requesthandler.backend = backend

    request = jasmine.createSpyObj('request', [
      'on'
      'once'
      'removeAllListeners'
    ])
    request.headers = {host: 'localhost'}
    request.url = "http://localhost:8888"
    response = jasmine.createSpyObj('response', [
      'writeHead'
      'write'
      'end'
    ])

  it "responds to root with 400 Bad Request", ->
    requesthandler.root(request, response)
    expectResponse 400
    expectContent()

  it "handles OPTIONS requests", ->
    requesthandler.options(request, response)
    expectResponse 200
    #  OPTIONS response has no body
    expectNoContent()

  it "serves a collection of documents", ->
    requesthandler.list(request, response, 'collection')
    expect(backend.list).toHaveBeenCalledWith 'collection',
        jasmine.any(Function), jasmine.any(Function)
    whenCallback(backend.list, 1).thenCallIt(requesthandler, [])
    whenCallback(backend.list, 2).thenCallIt(requesthandler, null)
    expectResponse 200
    expectContent()

  it "says 500 if listing the collection fails", ->
    requesthandler.list(request, response, 'collection')
    whenCallback(backend.list, 2).thenCallIt(requesthandler, new Error('error'))
    expect500()

  it "removes a collection", ->
    requesthandler.removeCollection(request, response, 'collection')
    expect(backend.removeCollection).toHaveBeenCalledWith 'collection',
        jasmine.any(Function)
    whenCallback(backend.removeCollection, 1).thenCallIt(requesthandler,
        undefined)
    expectResponse 204
    expectNoContent()

  it "says 500 if removing a collection fails", ->
    requesthandler.removeCollection(request, response, 'collection')
    expect(backend.removeCollection).toHaveBeenCalledWith 'collection',
        jasmine.any(Function)
    whenCallback(backend.removeCollection, 1).thenCallIt(requesthandler,
        new Error('error'))
    expect500()

  it "serves a document", ->
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(backend.read, 2).thenCallIt(requesthandler, undefined,
        {foo: 'bar', _id: 'key'}, 'key')
    expectResponse 200
    expectContent('{"foo":"bar","_id":"key"}')

  it "says 404 if serving a document fails", ->
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(backend.read, 2).thenCallIt(requesthandler, err404, null,
        'key')
    expect404()

  it "says 500 if serving a document fails for unknown reasons", ->
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(backend.read, 2).thenCallIt(
      requesthandler, new Error('error'), {}, 'key')
    expect500()

  it "creates a document", ->
    requesthandler.create(request, response, 'collection')
    stubCreateUpdate()
    expect(backend.create).toHaveBeenCalled()
    whenCallback(backend.create, 2).thenCallIt(requesthandler, undefined, 'key')
    # We only care about the location header here. But Jasmine is a bit stubborn
    # and without argument captors, it's not so easy to verify just this one
    # header.
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

  it "says 500 if creating a document fails", ->
    requesthandler.create(request, response, 'collection')
    stubCreateUpdate()
    whenCallback(backend.create, 2).thenCallIt(
      requesthandler, new Error('error'), 'key')
    expect500()

  it "updates a document", ->
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    expect(backend.update).toHaveBeenCalled()
    whenCallback(backend.update, 3).thenCallIt(requesthandler, undefined)
    expectResponse 204
    expectNoContent()

  it "says 404 if the document is not found during update", ->
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    whenCallback(backend.update, 3).thenCallIt(requesthandler, err404)
    expect404()

  it "says 500 if updating a document fails", ->
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    whenCallback(backend.update, 3).thenCallIt(
      requesthandler, new Error('error'))
    expect500()

  it "deletes a document", ->
    requesthandler.remove(request, response, 'collection', 'key')
    whenCallback(backend.remove, 2).thenCallIt(requesthandler, undefined)
    expectResponse 204
    expectNoContent()

  it "says 500 if deleting  a document fails", ->
    requesthandler.remove(request, response, 'collection', 'key')
    whenCallback(backend.remove, 2).thenCallIt(
      requesthandler, new Error('error'))
    expect500()

  it "handles bad requests", ->
    requesthandler.badRequest(response, "some very informational text")
    expectResponse 400
    expectContent('I\'m unable to process this request. I\'m terribly sorry.',
        '\nAdditional info: some very informational text')

  it "handles not found errors", ->
    requesthandler.notFound(response)
    expect404()

  it "handles internal server errors", ->
    requesthandler.internalServerError(response)
    expect500()

  it "handles unimplemented methods", ->
    requesthandler.notImplemented(response)
    expectResponse 501
    expectNoContent()


  whenCallback = (spy, callbackIndex) ->
    callback = spy.mostRecentCall.args[callbackIndex]
    ret =
      thenCallIt: (callOn, args...) ->
        callback.call(callOn, args...)
    return ret

  expectResponse = (status) ->
    expect(response.writeHead).toHaveBeenCalledWith(status, jasmine.any(Object))

  expectResponseAndHeaders = (status, headers) ->
    expect(response.writeHead).toHaveBeenCalledWith(status, headers)

  expectContent = (content...) ->
    if content and content.length > 0
      for string in content
        expect(response.write).toHaveBeenCalledWith(string)
    else
      expect(response.write).toHaveBeenCalled()
    expect(response.end).toHaveBeenCalled()

  expectNoContent = () ->
    expect(response.write).not.toHaveBeenCalled()
    expect(response.end).toHaveBeenCalled()

  expect404 = () ->
    expectResponse 404
    expectContent('The requested resource was not found. ')

  expect500 = () ->
    expectResponse 500
    expectContent('Oops, something went wrong.')

  stubCreateUpdate = () ->
    requestReaderOnData = request.on.calls[0].args[1]
    requestReaderOnEnd = request.once.calls[0].args[1]
    requestReaderOnData.call(requesthandler, '{"foo":"bar"}')
    requestReaderOnEnd.call(requesthandler)

