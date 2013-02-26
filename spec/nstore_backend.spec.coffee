describe "The nstore backend", ->

  sandbox = null
  fs = null
  nstore = null
  backend = null
  collection = null
  writeResponse = null

  beforeEach ->
    sandbox = require 'sandboxed-module'
    collection = jasmine.createSpyObj('collection', [
      'all'
      'get'
      'save'
      'remove'
    ])
    nstore = jasmine.createSpyObj('nstore', [
      'new'
    ])
    nstore.new.andReturn(collection)
    nstore.extend = () ->
      return nstore

    fs = jasmine.createSpyObj('fs', [
      'exists'
      'unlink'
    ])
    backend = sandbox.require '../backends/nstore_backend',
      requires:
        'nstore': nstore
        'fs': fs
    writeResponse = jasmine.createSpy('writeResponse')

  it "lists a collection", ->
    backend.list('collection', writeResponse)
    whenCallback(nstore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.all, 0).thenCallIt(backend, 'error', 'result')
    expect(writeResponse).toHaveBeenCalledWith('error', 'result')

  it "removes an existing collection", ->
    backend.removeCollection('collection', writeResponse)
    whenCallback(fs.exists, 1).thenCallIt(backend, true)
    expect(fs.unlink).toHaveBeenCalled()
    whenCallback(fs.unlink, 1).thenCallIt(backend, 'error')
    expect(writeResponse).toHaveBeenCalledWith('error')

  it "does not falter when trying to remove a non-existing collection", ->
    backend.removeCollection('collection', writeResponse)
    whenCallback(fs.exists, 1).thenCallIt(backend, false)
    expect(fs.unlink).not.toHaveBeenCalled()
    expect(writeResponse).toHaveBeenCalledWith(null)

  it "reads a document", ->
    backend.read('collection', 'key', writeResponse)
    whenCallback(nstore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1).thenCallIt(backend, 'error', 'document', 'key')
    expect(writeResponse).toHaveBeenCalledWith('error', 'document', 'key')

  it "creates a document", ->
    backend.create('collection', 'document', writeResponse)
    whenCallback(nstore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.save, 2).thenCallIt(backend, 'error', 'key')
    expect(writeResponse).toHaveBeenCalledWith('error', 'key')

  it "updates a document", ->
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(nstore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1).thenCallIt(backend, undefined)
    expect(collection.save).toHaveBeenCalled()
    whenCallback(collection.save, 2).thenCallIt(backend, 'error')
    expect(writeResponse).toHaveBeenCalledWith('error')

  it "throws 404 error when updating a non-existing document", ->
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(nstore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1).thenCallIt(backend, 'error')
    expect(collection.save).not.toHaveBeenCalled()
    expect(writeResponse).toHaveBeenCalledWith(404)

  it "removes a document", ->
    backend.remove('collection', 'key', writeResponse)
    whenCallback(nstore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.remove, 1).thenCallIt(backend, 'error')
    expect(writeResponse).toHaveBeenCalled()


  whenCallback = (spy, callbackIndex) ->
    callback = spy.mostRecentCall.args[callbackIndex]
    ret =
      thenCallIt: (callOn, args...) ->
        callback.call(callOn, args...)
    return ret
   
