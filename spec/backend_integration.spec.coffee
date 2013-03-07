# This spec tests the node-dirty backend without mocking/spying node-dirty or any
# other dependencies, that is, it truely accesses the node-dirty in-memory db and
# even lets node-dirty persist to disk.
describe "Common backend integration test:", ->

  TIMEOUT = 5000

  log = require('../log')
  Step = require('step')

  logIntermediateResults = true

  # define parameterized test
  parameterized = (backend_module, backend_name) ->
    describe "The " + backend_name + " backend (without mocked dependencies)", ->

      backend = null
      finished = false
      errors = []

      standardWaitsFor = () ->
        return finished
      waitForStepsToFinish = () -> waitsFor(standardWaitsFor, "all steps finishing", TIMEOUT)

      beforeEach ->
        (new (require('./test_config_reader'))()).createGlobalConfig()
        backend = require backend_module
        finished = false
        errors = []
        backend.removeCollection 'test', (err) ->
          if (err)
            log.error(err)

      afterEach ->
        log.debug("afterEach: closing connection")
        backend.closeConnection (err) ->
          if (err)
            log.error(err)
 
      it "removes collections idempotently", ->
        runs ->
          Step(
            () ->
              # Collection has already been removed in beforeEach; remove
              # collection again to check if removeCollection is idempotent
              # (For example, MongoDB throws an error when removing a
              # non-existing collection)
              backend.removeCollection('test', this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info('removeCollection 1 -> error: ' + error)
              errors.push error
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()

      it "says 404 when reading non-existing document", ->
        non_existing_doc = null
        runs ->
          Step(
            () ->
              backend.read('test', '123456789012', this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              non_existing_doc = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expect(errors[0]).toBe(404)
          expect(non_existing_doc).toBeNull()

      it "creates and reads documents", ->
        key_from_response = null
        read_document = null
        runs ->
          Step(
            () ->
              backend.create('test', {some_attribute: 'abc'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info('create -> error, key: ' + error + ', ' + key)
              errors.push error
              key_from_response = key.toString()
              backend.read('test', key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              read_document = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()
          expect(read_document).toBeDefined()
          expect(read_document['some_attribute']).toEqual('abc')

      it "lists an empty collection", ->
        listing = null
        runs ->
          Step(
            () ->
              backend.list('test', this)
            ,
            (error, results) ->
              if (logIntermediateResults)
                log.info('list -> error, results: ' + error + ', ' + JSON.stringify(results))
              errors.push error
              listing = results
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()
          expect(listing.length).toEqual(0)
 
      it "lists a collection", ->
        keys = []
        listing = null
        key_from_listing = null
        read_document = null
        runs ->
          Step(
            () ->
              backend.create('test', {some_attribute: 'abc'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info('create -> error, key: ' + error + ', ' + key)
              errors.push error
              keys[0] = key.toString()
              backend.create('test', {some_attribute: 'xyz'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info('create -> error, key: ' + error + ', ' + key)
              errors.push error
              keys[1] = key.toString()
              backend.list('test', this)
            ,
            (error, results) ->
              if (logIntermediateResults)
                log.info('list -> error, results: ' + error + ', ' + JSON.stringify(results))
              errors.push error
              listing = results
              # one extra step (which do not really belong into this spec):
              # use key from listing to read single document
              key_from_listing = listing[0]._id.toString()
              backend.read('test', key_from_listing, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              read_document = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()
          expect(listing.length).toBe(2)
          fromListing = []
          fromListing[0] = findInArray listing, keys[0]
          fromListing[1] = findInArray listing, keys[1]
          expect(fromListing[0]).toBeDefined()
          expect(fromListing[0]['some_attribute']).toEqual('abc')
          expect(fromListing[1]).toBeDefined()
          expect(fromListing[1]['some_attribute']).toEqual('xyz')
          expect(read_document).toBeDefined()
          expect(fromListing[0]).toEqual(read_document)

      it "says 404 when updating a non-existing document", ->
        runs ->
          Step(
            () ->
              backend.update('test', '123456789012', {second_attribute: 123, third_attribute: 456}, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info('update -> error: ' + error)
              errors.push error
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expect(errors[0]).toBe(404)


      it "updates a document", ->
        key_from_response = null
        read_document = null
        runs ->
          Step(
            () ->
              backend.create('test', {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info('create -> error, key: ' + error + ', ' + key)
              errors.push error
              key_from_response = key.toString()
              backend.update('test', key_from_response, {second_attribute: 123, third_attribute: 'baz'}, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info('update -> error: ' + error)
              errors.push error
              backend.read('test', key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              read_document = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()
          expect(read_document).not.toBeNull()
          expect(read_document.first_attribute).toBeUndefined()
          expect(read_document.second_attribute).toEqual(123)
          expect(read_document.third_attribute).toEqual('baz')

      it "removes a document", ->
        key_from_response = null
        read_document_before_remove = null
        read_document_after_remove = null
        runs ->
          Step(
            () ->
              backend.create('test', {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info('create -> error, key: ' + error + ', ' + key)
              errors.push error
              key_from_response = key.toString()
              backend.read('test', key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              read_document_before_remove = doc
              backend.remove('test', key_from_response, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info('remove -> error: ' + error)
              errors.push error
              backend.read('test', key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              read_document_after_remove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3]).toBe(404)
          expect(read_document_before_remove).not.toBeNull()
          expect(read_document_after_remove).toBeNull()

      it "removes a document twice while being idempotent", ->
        key_from_response = null
        read_document_after_remove = null
        runs ->
          Step(
            () ->
              backend.create('test', {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info('create -> error, key: ' + error + ', ' + key)
              errors.push error
              key_from_response = key.toString()
              backend.remove('test', key_from_response, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info('remove -> error: ' + error)
              errors.push error
              backend.remove('test', key_from_response, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info('remove -> error: ' + error)
              errors.push error
              backend.read('test', key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              read_document_after_remove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3]).toBe(404)
          expect(read_document_after_remove).toBeNull()

      it "does not return a document from a removed collection", ->
        key_from_response = null
        read_document_before_remove = null
        read_document_after_remove = null
        runs ->
          Step(
            () ->
              backend.create('test', {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info('create -> error, key: ' + error + ', ' + key)
              errors.push error
              key_from_response = key.toString()
              backend.read('test', key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              read_document_before_remove = doc
              backend.removeCollection('test', this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info('removeCollection -> error: ' + error)
              errors.push error
              backend.read('test', key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info('read -> error, doc, key: ' + error + ', ' + doc + ', ' + key)
              errors.push error
              read_document_after_remove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3]).toBe(404)
          expect(read_document_before_remove).not.toBeNull()
          expect(read_document_after_remove).toBeNull()


      xit "does stuff", ->
        runs ->
          Step(
            () ->
              console.log("first step")
              backend.list('test', this)
            ,
            (error, results) ->
              if (logIntermediateResults)
                log.info('list -> error, results: ' + error + ', ' + JSON.stringify(results))
              errors.push error
              console.log("second step")
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()

      xit "does stuff", ->
        runs ->
          Step(
            () ->
              console.log("first step")
              backend.list('test', this)
            ,
            (error, results) ->
              if (logIntermediateResults)
                log.info('list -> error, results: ' + error + ', ' + JSON.stringify(results))
              errors.push error
              console.log("second step")
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()

      xit "does stuff", ->
        runs ->
          Step(
            () ->
              console.log("first step")
              backend.list('test', this)
            ,
            (error, results) ->
              if (logIntermediateResults)
                log.info('list -> error, results: ' + error + ', ' + JSON.stringify(results))
              errors.push error
              console.log("second step")
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()

      xit "does stuff", ->
        runs ->
          Step(
            () ->
              console.log("first step")
              backend.list('test', this)
            ,
            (error, results) ->
              if (logIntermediateResults)
                log.info('list -> error, results: ' + error + ', ' + JSON.stringify(results))
              errors.push error
              console.log("second step")
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()

      ###
      HELPER FUNCTIONS
      ###
 
      expectNoErrors = () ->
        expectNoError(i, error) for error, i in errors[0..errors.length - 1]

      expectNoError = (index, error) ->
        log.debug("error[#{index}]: #{error}")
        expect(error == null || error == undefined).toBe(true)

      findInArray = (array, id) ->
        for item in array
          if (item._id.toString() == id.toString())
            return item

  ###
  Call all parameterized tests
  ###

  parameterized('../backends/node_dirty_backend', 'node-dirty')
  parameterized('../backends/nstore_backend', 'nStore')
  parameterized('../backends/mongodb_backend', 'MongoDB')

