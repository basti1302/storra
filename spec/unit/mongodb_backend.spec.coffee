# This spec tests the MongoDB backend by mocking/spying the MongoDB node driver and any
# other dependency.
describe "The MongoDB backend (with mocked dependencies)", ->

  sandbox = null
  mongodb = null
  mongoClient = null
  server = null
  backend = null
  db = null
  collection = null
  cursor = null
  writeDocument = null
  writeEnd = null
  writeResponse = null

  beforeEach ->
    (new (require('../test_config_reader'))()).createGlobalConfig()

    sandbox = require 'sandboxed-module'
    
    cursor = jasmine.createSpyObj('cursor', [
      'each'
    ])
    collection = jasmine.createSpyObj('collection', [
      'find'
      'findOne'
      'insert'
      'update'
      'remove'
    ])
    collection.find.andReturn(cursor)
    db = jasmine.createSpyObj('db', [
      'collection'
      'dropCollection'
    ])
    db.collection.andReturn(collection)

    mongodb = jasmine.createSpyObj('mongodb', [
      'MongoClient'
      'Server'
      'ObjectID'
    ])
    mongoClient = jasmine.createSpyObj('mongoClient', [
      'db'
      'open'
      'close'
    ])
    mongoClient.db.andReturn(db)
    mongoClient._db = {
      openCalled: true
      _state: 'connected'
    }
    server = jasmine.createSpyObj('server', [
      'foobar'
    ])
    mongodb.MongoClient.andReturn(mongoClient)
    mongodb.Server.andReturn(server)
    mongodb.ObjectID.andReturn('123456789012')

    MongoDBConnector = sandbox.require '../../lib/backends/mongodb_backend',
      requires:
        'mongodb': mongodb
    backend = new MongoDBConnector()

    writeDocument = jasmine.createSpy('writeDocument')
    writeEnd = jasmine.createSpy('writeEnd')
    writeResponse = jasmine.createSpy('writeResponse')

  it "opens a connection if not yet connected", ->
    mongoClient._db = { openCalled: false }
    backend.list('collection', writeDocument, writeEnd)
    expect(mongoClient.open).toHaveBeenCalled()

  it "uses an existing connection without opening a second one", ->
    mongoClient._db = { openCalled: true }
    backend.list('collection', writeDocument, writeEnd)
    expect(mongoClient.open).not.toHaveBeenCalled()

  it "waits for a connection to be established if neccessary", ->
    backend.setRetryParameters(3, 10)
    shouldHaveConnected = false
    runs ->
      mongoClient._db = { openCalled: true, _state: 'connecting' }
      backend.list('collection', writeDocument, writeEnd)
      setTimeout(() ->
        mongoClient._db._state = 'connected'
      , 15)
      setTimeout(() ->
        shouldHaveConnected = true
      , 25)
    waitsFor(() ->
      return shouldHaveConnected
    , 3 * 10 + 100)
    runs ->
      expect(db.collection).toHaveBeenCalled()

  it "does not wait infinitely long for a connection to be established", ->
    backend.setRetryParameters(3, 10)
    errorPassedToRequestHandler = null
    writeEnd = (err) ->
      errorPassedToRequestHandler = err
    runs ->
      mongoClient._db = { openCalled: true, _state: 'connecting' }
      backend.list('collection', writeDocument, writeEnd)
    waitsFor(() ->
      return errorPassedToRequestHandler != null
    , 3 * 10 + 100)
    runs ->
      expect(errorPassedToRequestHandler instanceof Error).toBe(true)
      expect(errorPassedToRequestHandler.http_status).toEqual(500)
      expect(errorPassedToRequestHandler.message).toEqual('Could not connect to MongoDB after 3 retries, MongoClient is still in state connecting.')

  it "closes the connection on demand", ->
    backend.closeConnection(null)
    expect(mongoClient.close).toHaveBeenCalledWith(jasmine.any(Function))

  it "lists a collection", ->
    backend.list('collection', writeDocument, writeEnd)
    cb = getCallback(cursor.each, 0)
    cb.call(backend, undefined, {a: "b"})
    cb.call(backend, undefined, {c: "d"})
    cb.call(backend, undefined, null)
    expect(writeDocument).toHaveBeenCalledWith({a: "b"})
    expect(writeDocument).toHaveBeenCalledWith({c: "d"})
    expect(writeEnd).toHaveBeenCalledWith(null)

  it "removes an existing collection", ->
    backend.removeCollection('collection', writeResponse)
    whenCallback(db.dropCollection, 1).thenCallIt(backend, null, 1)
    expect(writeResponse).toHaveBeenCalledWith(null)

  it "does not falter when trying to remove a non-existing collection", ->
    backend.removeCollection('collection', writeResponse)
    whenCallback(db.dropCollection, 1).thenCallIt(backend, new Error('ns not found'), 0)
    expect(writeResponse).toHaveBeenCalledWith(null)

  it "passes up all errors that are not 'ns not found' in removeCollection", ->
    backend.removeCollection('collection', writeResponse)
    err = new Error('something weird happend')
    whenCallback(db.dropCollection, 1).thenCallIt(backend, err, 0)
    expect(writeResponse).toHaveBeenCalledWith(err)

  it "reads a document", ->
    backend.read('collection', 'key', writeResponse)
    whenCallback(collection.findOne, 1).thenCallIt(backend, undefined, {a: 'b', _id: 'key'})
    expect(writeResponse).toHaveBeenCalledWith(undefined, {a: 'b', _id: 'key'}, 'key')

  it "passes up the error when reading a document", ->
    backend.read('collection', 'key', writeResponse)
    whenCallback(collection.findOne, 1).thenCallIt(backend, 'error', {a: 'b', _id: 'key'})
    expect(writeResponse).toHaveBeenCalledWith('error', null, 'key')

  it "says 404 when reading an non-existing document", ->
    backend.read('collection', 'key', writeResponse)
    whenCallback(collection.findOne, 1).thenCallIt(backend, undefined, null)
    expect(writeResponse).toHaveBeenCalledWith(jasmine.any(Object), null, 'key')
    expect(writeResponse.mostRecentCall.args[0].http_status).toEqual(404)

  it "creates a document", ->
    backend.create('collection', 'document', writeResponse)
    whenCallback(collection.insert, 2).thenCallIt(backend, undefined, [{_id:{toHexString:()->'the hex string'}}])
    expect(writeResponse).toHaveBeenCalledWith(undefined, 'the hex string')

  it "passes up the error when creating a document", ->
    backend.create('collection', 'document', writeResponse)
    whenCallback(collection.insert, 2).thenCallIt(backend, 'error', null)
    expect(writeResponse).toHaveBeenCalledWith('error', null)

  it "passes on null if MongoDB returns no result", ->
    backend.create('collection', 'document', writeResponse)
    whenCallback(collection.insert, 2).thenCallIt(backend, null, null)
    expect(writeResponse).toHaveBeenCalledWith(null, null)

  it "updates a document", ->
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(collection.update, 3).thenCallIt(backend, undefined, 1)
    expect(writeResponse).toHaveBeenCalledWith(undefined)

  it "passes on the error when updating a document", ->
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(collection.update, 3).thenCallIt(backend, 'error', 1)
    expect(writeResponse).toHaveBeenCalledWith('error')

  it "throws 404 error when updating a non-existing document", ->
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(collection.update, 3).thenCallIt(backend, undefined, 0)
    expect(writeResponse).toHaveBeenCalled()
    expect(writeResponse.mostRecentCall.args[0].http_status).toEqual(404)

  it "creates an error if more than one document have changed", ->
    # This will never happen™. We test the behaviour anyway.
    backend.update('collection', 'key', 'document', writeResponse)
    whenCallback(collection.update, 3).thenCallIt(backend, undefined, 2)
    expect(writeResponse).toHaveBeenCalledWith(jasmine.any(Error))

  it "removes a document", ->
    backend.remove('collection', 'key', writeResponse)
    whenCallback(collection.remove, 1).thenCallIt(backend, undefined, 42)
    expect(writeResponse).toHaveBeenCalledWith(undefined)

  it "passes on the error when removing a document", ->
    backend.remove('collection', 'key', writeResponse)
    whenCallback(collection.remove, 1).thenCallIt(backend, 'error', undefined)
    expect(writeResponse).toHaveBeenCalledWith('error')

  getCallback = (spy, callbackIndex) ->
    callback = spy.mostRecentCall.args[callbackIndex]

  whenCallback = (spy, callbackIndex) ->
    callback = getCallback(spy, callbackIndex)
    ret =
      thenCallIt: (callOn, args...) ->
        callback.call(callOn, args...)
    return ret
