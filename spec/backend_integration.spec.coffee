# This spec tests the node-dirty backend without mocking/spying node-dirty or any
# other dependencies, that is, it truely accesses the node-dirty in-memory db and
# even lets node-dirty persist to disk.
describe "Common backend integration test:", ->

  TIMEOUT = 5000

  log = require('../log')
  Step = require('step')

  logIntermediateResults = true

  beforeEach ->
    finished = false

  parameterized = (backend_module, backend_name) ->
    describe "The " + backend_name + " backend (without mocked dependencies)", ->

    # TODO Use _id from listing to read one doc

    backend = null
    finished = false

    listing = null
    keys = []
    read_documents = []
    errors = []

    beforeEach ->
      backend = require backend_module
      listing = null
      keys = []
      read_documents = []
      errors = []
      finished = false
      errors = []

    # caution: ugly all-in-one-test ahead
    # this test simulates a little workflow:
    # 0) removeCollection (in case it already exists)
    # 1) create collection
    # 2) create two documents
    # 3) list the collection
    # 4) read documents
    # 5) update documents
    # 6) read documents again
    # 7) remove documents

    ###
    TODO: Split this up in smaller tests:
    read non-existing doc
    create doc - read doc
    list empty collection
    create doc * 2 - list collection
    update non-existing doc
    create doc - update doc - read doc
    create doc - read doc - remove doc - read doc
    create doc - read doc - remove colleciton - read doc
    create doc - remove doc - remove same doc again -> idempotent?
    remove collection - remove same collection again -> idempotent? 
    >> with removeCollection in the beforeEach of all tests
    ###

    it "creates, persists, lists, updates, retrieves and removes entries", ->
      runs ->
        Step(
          () ->
            backend.removeCollection('test', this)
          ,
          # remove collection again to check if removeCollection is idempotent
          # (For example, MongoDB throws an error when removing a non-existing collection)
          (error) ->
            if (logIntermediateResults)
              log.info('removeCollection 1 -> error: ' + error)
            errors.push error
            backend.removeCollection('test', this)
          ,
          (error) ->
            if (logIntermediateResults)
              log.info('removeCollection 2 -> error: ' + error)
            errors.push error
            backend.create('test', {some_attribute: 'abc'}, this)
          ,
          (error, key) ->
            if (logIntermediateResults)
              log.info('create -> error, key: ' + error + ', ' + key)
            errors.push error
            keys[0] = key
            backend.create('test', {some_attribute: 'xyz'}, this)
          ,
          (error, key) ->
            if (logIntermediateResults)
              log.info('create -> error, key: ' + error + ', ' + key)
            errors.push error
            keys[1] = key
            backend.list('test', this)
          ,
          (error, results) ->
            if (logIntermediateResults)
              log.info('list -> error, results: ' + error + ', ' + JSON.stringify(results))
            errors.push error
            listing = results
            backend.read('test', keys[0], this)
          ,
          (error, doc, key) ->
            if (logIntermediateResults)
              log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
            errors.push error
            read_documents[0] = doc
            backend.read('test', keys[1], this)
          ,
          (error, doc, key) ->
            if (logIntermediateResults)
              log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
            errors.push error
            read_documents[1] = doc
            backend.update('test', keys[0], {second_attribute: 123, third_attribute: 456}, this)
        ,
          (error) ->
            if (logIntermediateResults)
              log.info('update -> error: ' + error)
            errors.push error
            backend.read('test', keys[0], this)
          (error, doc, key) ->
            if (logIntermediateResults)
              log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
            errors.push error
            read_documents[2] = doc
            backend.remove('test', keys[1], this)
          (error) ->
            if (logIntermediateResults)
              log.info('remove -> error: ' + error)
            errors.push error
            backend.read('test', keys[1], this)
          (error, doc, key) ->
            if (logIntermediateResults)
              log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
            errors.push error
            read_documents[3] = doc
            backend.closeConnection(this)
          (error) ->
            if (logIntermediateResults)
              log.info('closeConnection -> error: ' + error)
            errors.push error
            finished = true
        )
    
      waitsFor(() ->
        return finished
      , "all steps finishing", TIMEOUT)
      runs ->
        checkError(i, error) for error, i in errors[0..errors.length - 3]
        log.debug("error[#{errors.length - 2}]: #{errors[errors.length - 2]}")
        expect(errors[errors.length - 2]).toBe(404)
        checkError(errors.length - 1, errors[errors.length - 1])
        expect(keys[0]).not.toBe(null)
        expect(keys[1]).not.toBe(null)
        expect(listing.length).toBe(2)
        fromListing = []
        fromListing[0] = findInArray listing, keys[0]
        fromListing[1] = findInArray listing, keys[1]
        expect(fromListing[0]).toBeDefined()
        expect(fromListing[0]['some_attribute']).toEqual('abc')
        expect(fromListing[1]).toBeDefined()
        expect(fromListing[1]['some_attribute']).toEqual('xyz')
        expect(read_documents[0]).toBeDefined()
        expect(read_documents[0]['some_attribute']).toEqual('abc')
        expect(read_documents[1]).toBeDefined()
        expect(read_documents[1]['some_attribute']).toEqual('xyz')
        expect(read_documents[1]).toBeDefined()
        expect(read_documents[2]['second_attribute']).toEqual(123)
        expect(read_documents[2]['third_attribute']).toEqual(456)
        expect(read_documents[3]).toBeNull()
 
  parameterized('../backends/node_dirty_backend', 'node-dirty')
  parameterized('../backends/nstore_backend', 'nStore')
  parameterized('../backends/mongodb_backend', 'MongoDB')

  checkError = (index, error) ->
    log.debug("error[#{index}]: #{error}")
    expect(error == null || error == undefined).toBe(true)

  findInArray = (array, id) ->
    for item in array
      if (item._id.toString() == id.toString())
        return item

