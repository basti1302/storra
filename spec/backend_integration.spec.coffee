# This spec tests the node-dirty backend without mocking/spying node-dirty or any
# other dependencies, that is, it truely accesses the node-dirty in-memory db and
# even lets node-dirty persist to disk.
describe "Common backend integration test:", ->

  log = require('../log')
  Step = require('step')

  logIntermediateResults = true

  beforeEach ->
    finished = false

  parameterized = (backend_module, backend_name) ->
    describe "The " + backend_name + " backend (without mocked dependencies)", ->

    backend = null
    finished = false
    key1 = null
    key2 = null
    listing = null
    read1 = null
    read2 = null
    read3 = null
    read4 = null
    errors = []

    beforeEach ->
      backend = require backend_module
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
    >> with removeCollection in the beforeEach of all tests
    ###

    it "creates, persists, lists, updates, retrieves and removes entries", ->
      runs ->
        Step(
          () ->
            backend.removeCollection('test', this)
          ,
          (error) ->
            if (logIntermediateResults)
              log.info('removeCollection -> error: ' + error)
            errors.push error
            backend.create('test', {some_attribute: 'abc'}, this)
          ,
          (error, key) ->
            if (logIntermediateResults)
              log.info('create -> error, key: ' + error + ', ' + key)
            errors.push error
            key1 = key
            backend.create('test', {some_attribute: 'xyz'}, this)
          ,
          (error, key) ->
            if (logIntermediateResults)
              log.info('create -> error, key: ' + error + ', ' + key)
            errors.push error
            key2 = key
            backend.list('test', this)
          ,
          (error, results) ->
            if (logIntermediateResults)
              log.info('list -> error, results: ' + error + ', ' + results)
            errors.push error
            listing = results
            backend.read('test', key1, this)
          ,
          (error, doc, key) ->
            if (logIntermediateResults)
              log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
            errors.push error
            read1 = doc
            backend.read('test', key2, this)
          ,
          (error, doc, key) ->
            if (logIntermediateResults)
              log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
            errors.push error
            read2 = doc
            backend.update('test', key1, {second_attribute: 123, third_attribute: 456}, this)
        ,
          (error) ->
            if (logIntermediateResults)
              log.info('update -> error: ' + error)
            errors.push error
            backend.read('test', key1, this)
          (error, doc, key) ->
            if (logIntermediateResults)
              log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
            errors.push error
            read3 = doc
            backend.remove('test', key2, this)
          (error) ->
            if (logIntermediateResults)
              log.info('remove -> error: ' + error)
            errors.push error
            backend.read('test', key2, this)
          (error, doc, key) ->
            if (logIntermediateResults)
              log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
            errors.push error
            read4 = doc
            finished = true
        )
    
      waitsFor(() ->
        return finished
      , "all steps finishing", 200)
      runs ->
        checkError(i, error) for error, i in errors[0..errors.length - 2]
        expect(errors[errors.length - 1]).toBe(404)
        expect(key1).not.toBe(null)
        expect(key2).not.toBe(null)
        # enable check when backends return array instead of object
        # expect(listing.length).toBe(2)
        fromListing1 = listing[key1]
        fromListing2 = listing[key2]
        expect(fromListing1).toBeDefined()
        expect(fromListing1['some_attribute']).toEqual('abc')
        expect(fromListing2).toBeDefined()
        expect(fromListing2['some_attribute']).toEqual('xyz')
        expect(read1).toBeDefined()
        expect(read1['some_attribute']).toEqual('abc')
        expect(read2).toBeDefined()
        expect(read2['some_attribute']).toEqual('xyz')
        expect(read2).toBeDefined()
        expect(read3['second_attribute']).toEqual(123)
        expect(read3['third_attribute']).toEqual(456)
        expect(read4).toBeNull()
 
  parameterized('../backends/node_dirty_backend', 'node-dirty')
  parameterized('../backends/mongodb_backend', 'MongoDB')

  checkError = (index, error) ->
    log.debug("error[#{index}]: #{error}")
    expect(error == null || error == undefined).toBe(true)
