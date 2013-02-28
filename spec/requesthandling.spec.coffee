describe "The request handler", ->

  sandbox = null
  storage = null
  requesthandler = null
  request = null
  response = null

  beforeEach ->
    sandbox = require 'sandboxed-module'
    storage = jasmine.createSpyObj('storage', [
      'list'
      'removeCollection'
      'read'
      'create'
      'update'
      'remove'
    ])
    request = jasmine.createSpyObj('request', [
      'on'
    ])
    request.headers = {host: 'localhost'}
    request.url = "http://localhost:8888"
    response = jasmine.createSpyObj('response', [
      'writeHead'
      'write'
      'end'
    ])

    global.storra_backend = './storage'
    requesthandler = sandbox.require '../requesthandler',
      requires:
        './storage': storage

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
    expect(storage.list).toHaveBeenCalledWith 'collection', jasmine.any(Function)
    whenCallback(storage.list, 1).thenCallIt(requesthandler, undefined, [])
    expectResponse 200
    expectContent()

  it "says 500 if listing the collection fails", ->
    requesthandler.list(request, response, 'collection')
    whenCallback(storage.list, 1).thenCallIt(requesthandler, 'error', [])
    expect500()

  it "removes a collection", ->
    requesthandler.removeCollection(request, response, 'collection')
    expect(storage.removeCollection).toHaveBeenCalledWith 'collection', jasmine.any(Function)
    whenCallback(storage.removeCollection, 1).thenCallIt(requesthandler, undefined)
    expectResponse 204
    expectNoContent()

  it "says 500 if removing a collection fails", ->
    requesthandler.removeCollection(request, response, 'collection')
    expect(storage.removeCollection).toHaveBeenCalledWith 'collection', jasmine.any(Function)
    whenCallback(storage.removeCollection, 1).thenCallIt(requesthandler, 'error')
    expect500()

  it "serves a document", ->
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(storage.read, 2).thenCallIt(requesthandler, undefined, {foo: 'bar', _id: 'key'}, 'key')
    expectResponse 200
    expectContent('{"foo":"bar","_id":"key"}')

  it "says 404 if serving a document fails", ->
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(storage.read, 2).thenCallIt(requesthandler, 404, null, 'key')
    expect404()
    
  it "says 500 if serving a document fails for unknown reasons", ->
    requesthandler.retrieve(request, response, 'collection', 'key')
    whenCallback(storage.read, 2).thenCallIt(requesthandler, 'error', {}, 'key')
    expect500()

  it "creates a document", ->
    requesthandler.create(request, response, 'collection')
    stubCreateUpdate()
    expect(storage.create).toHaveBeenCalled()
    whenCallback(storage.create, 2).thenCallIt(requesthandler, undefined, 'key')
    expectResponse 201
    # TODO Check if location header is written correctly
    #expect(response.writeHead).toHaveBeenCalledWith("Location"... )
    expectNoContent()

  it "says 500 if creating a document fails", ->
    requesthandler.create(request, response, 'collection')
    stubCreateUpdate()
    whenCallback(storage.create, 2).thenCallIt(requesthandler, 'error', 'key')
    expect500()

  it "updates a document", ->
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    expect(storage.update).toHaveBeenCalled()
    whenCallback(storage.update, 3).thenCallIt(requesthandler, undefined)
    expectResponse 204
    expectNoContent()

  it "says 404 if the document is not found during update", ->
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    whenCallback(storage.update, 3).thenCallIt(requesthandler, 404)
    expect404()

  it "says 500 if updating a document fails", ->
    requesthandler.update(request, response, 'collection', 'key')
    stubCreateUpdate()
    whenCallback(storage.update, 3).thenCallIt(requesthandler, 'error')
    expect500()

  it "deletes a document", ->
    requesthandler.remove(request, response, 'collection', 'key')
    whenCallback(storage.remove, 2).thenCallIt(requesthandler, undefined)
    expectResponse 204
    expectNoContent()

  it "says 500 if deleting  a document fails", ->
    requesthandler.remove(request, response, 'collection', 'key')
    whenCallback(storage.remove, 2).thenCallIt(requesthandler, 'error')
    expect500()

  it "handles bad requests", ->
    requesthandler.badRequest(response, "some very informational text")
    expectResponse 400
    #expect(response.write).toHaveBeenCalledWith('I\'m unable to process this request. I\'m terribly sorry.')
    #expect(response.write).toHaveBeenCalledWith('\nAdditional info: some very informational text')
    expectContent('I\'m unable to process this request. I\'m terribly sorry.', '\nAdditional info: some very informational text')

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
    expectContent('The requested resource was not found.')

  expect500 = () ->
    expectResponse 500
    expectContent('Oops, something went wrong.')

  stubCreateUpdate = () ->
    requestReaderOnData = request.on.calls[0].args[1]
    requestReaderOnEnd = request.on.calls[1].args[1]
    requestReaderOnData.call(requesthandler, '{"foo":"bar"}')
    requestReaderOnEnd.call(requesthandler)

