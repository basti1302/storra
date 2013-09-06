# This spec tests the nStore backend by mocking/spying nStore and any
# other dependency.
describe "The nStore backend", ->

  fs = null
  nStore = null
  backend = null
  collection = null
  writeDocument = null
  writeEnd = null
  writeResponse = null

  genericError = new Error()
  errorNoEntity = new Error('Document does not exist')
  errorNoEntity.errno = require('constants').ENOENT

  beforeEach ->
    collection = jasmine.createSpyObj('collection', [
      'all'
      'get'
      'save'
      'remove'
    ])
    nStore = jasmine.createSpyObj('nstore', [
      'new'
    ])
    nStore.new.andReturn(collection)
    nStore.extend = () ->
      return nStore

    fs = jasmine.createSpyObj('fs', [
      'exists'
      'unlink'
    ])
    NStoreConnector = require '../../lib/backends/nstore_backend'
    backend = new NStoreConnector()
    backend.nStore = nStore
    backend.fs = fs
    backend.os = require('os')
    backend.init()
    # disable collection caching to ensure test isolation
    spyOn(backend.cache, 'get').andReturn(null)

    writeDocument = jasmine.createSpy('writeDocument')
    writeEnd = jasmine.createSpy('writeEnd')
    writeResponse = jasmine.createSpy('writeResponse')

  it "lists a collection", ->
    backend.list('collection', writeDocument, writeEnd)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.all, 0).thenCallIt(backend, undefined,
        {key1: {a: "b"}, key2: {c: "d"}})
    expect(writeDocument).toHaveBeenCalledWith({a: "b", _id: "key1"})
    expect(writeDocument).toHaveBeenCalledWith({c: "d", _id: "key2"})
    expect(writeEnd).toHaveBeenCalledWith(null)

  it "passes on errors when listing a collection fails", ->
    backend.list('collection', writeDocument, writeEnd)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.all, 0)
      .thenCallIt(backend, genericError, 'whatever')
    expect(writeDocument).not.toHaveBeenCalled()
    expect(writeEnd).toHaveBeenCalledWith(genericError)

  it "removes an existing collection", ->
    backend.removeCollection('collection', writeResponse)
    whenCallback(fs.exists, 1).thenCallIt(backend, true)
    expect(fs.unlink).toHaveBeenCalled()
    whenCallback(fs.unlink, 1).thenCallIt(backend, null)
    expect(writeResponse).toHaveBeenCalledWith(null)

  it "does not falter when trying to remove a non-existing collection", ->
    backend.removeCollection('collection', writeResponse)
    whenCallback(fs.exists, 1).thenCallIt(backend, false)
    expect(fs.unlink).not.toHaveBeenCalled()
    expect(writeResponse).toHaveBeenCalledWith(null)

  it "reads a document", ->
    backend.read('collection', 'key', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1).thenCallIt(backend, null, 'document',
        'key')
    expect(writeResponse).toHaveBeenCalledWith(null, 'document', 'key')

  it "says 404 when reading a non-existing document", ->
    backend.read('collection', 'key', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1)
      .thenCallIt(backend, errorNoEntity, null, 'key')
    expect(writeResponse).toHaveBeenCalled()
    expect(writeResponse.mostRecentCall.args[0].httpStatus).toBe(404)

  it "reports error when reading a document fails for a different reason
 (not 404/not found)", ->
    backend.read('collection', 'key', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1)
      .thenCallIt(backend, genericError, null, null)
    expect(writeResponse).toHaveBeenCalledWith(genericError, null, null)

  it "creates a document", ->
    backend.create('collection', 'document', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.save, 2).thenCallIt(backend, null, 'key')
    expect(writeResponse).toHaveBeenCalledWith(null, 'key')

  it "reports error when creating a document fails", ->
    backend.create('collection', 'document', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.save, 2).thenCallIt(backend, genericError, null)
    expect(writeResponse).toHaveBeenCalledWith(genericError, null)

  it "updates a document", ->
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1).thenCallIt(backend, undefined)
    expect(collection.save).toHaveBeenCalled()
    whenCallback(collection.save, 2).thenCallIt(backend, null)
    expect(writeResponse).toHaveBeenCalledWith(null)

  it "says 404 error when updating a non-existing document", ->
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1).thenCallIt(backend, errorNoEntity)
    expect(collection.save).not.toHaveBeenCalled()
    expect(writeResponse).toHaveBeenCalled()
    expect(writeResponse.mostRecentCall.args[0].httpStatus).toBe(404)

  it "reports error when updating a document fails for a different reason
 (not 404/not found)", ->
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.get, 1).thenCallIt(backend, genericError)
    expect(collection.save).not.toHaveBeenCalled()
    expect(writeResponse).toHaveBeenCalledWith(genericError)

  it "removes a document", ->
    backend.remove('collection', 'key', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.remove, 1).thenCallIt(backend, null)
    expect(writeResponse).toHaveBeenCalled()

  it "ignores not found when removing a document", ->
    backend.remove('collection', 'key', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.remove, 1).thenCallIt(backend, errorNoEntity)
    expect(writeResponse).toHaveBeenCalledWith(null)

  it "reports error when removing a document fails for a different reason
 (not 404/not found)", ->
    backend.remove('collection', 'key', writeResponse)
    whenCallback(nStore.new, 1).thenCallIt(backend, undefined)
    whenCallback(collection.remove, 1).thenCallIt(backend, genericError)
    expect(writeResponse).toHaveBeenCalledWith(genericError)


  whenCallback = (spy, callbackIndex) ->
    callback = spy.mostRecentCall.args[callbackIndex]
    ret =
      thenCallIt: (callOn, args...) ->
        callback.call(callOn, args...)
    return ret
