# This spec tests the node-dirty backend without mocking/spying node-dirty or any
# other dependencies, that is, it truely accesses the node-dirty in-memory db and
# even lets node-dirty persist to disk.
describe "Common backend integration test:", ->

  TIMEOUT = 5000

  log = require('../../log')
  Step = require('step')
  uuid = require('node-uuid')

  logIntermediateResults = true
  
  (new (require('../test_config_reader'))()).createGlobalConfig()

  # define parameterized test
  parameterized = (backend_module, backend_name) ->
    describe "The #{backend_name} backend (without mocked dependencies)", ->

      backend = null
      finished = false
      errors = []
      collection = null

      standardWaitsFor = () ->
        return finished
      waitForStepsToFinish = () -> waitsFor(standardWaitsFor, "all steps finishing", TIMEOUT)

      beforeEach ->
        log.error "IN beforeEach 1: #{JSON.stringify(global.storra_config)}"
        log.error "IN beforeEach 2: #{JSON.stringify(global.storra_config)}"
        finished = false
        errors = []
        Connector = require backend_module
        backend = new Connector()
        collection = uuid.v1()

        backend.checkAvailable(
          () ->
            log.debug("Backend #{backend_name} is available.")
          ,
          (err) ->
            # If the backend under test is not there, we just kill the node.js
            # process to immediately stop the test run. This is extremely
            # questionable, but right now it helps - otherwise you'll get a lot
            # of failures in the test run and wonder what on earth is going wrong.
            # It would be nice if Jasmine offered a version of the fail method
            # that also stops the current spec (right now, jasmine just continues
            # with the spec and reports all failures at the end).
            log.error(err)
            log.error("Backend #{backend_name} is not available, killing test process!")
            process.exit(1)
        )

      afterEach ->
        log.debug("afterEach: closing connection")
        backend.removeCollection collection, (err) ->
          if (err)
            log.error(err)
        backend.closeConnection (err) ->
          if (err)
            log.error(err)
 
      it "removes collections idempotently", ->
        runs ->
          Step(
            () ->
              # Collection has not yet been created. However, removing it
              # should throw no error since delete is ought to be idempotent.
              backend.removeCollection(collection, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("removeCollection 1 -> error: #{error}")
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
              backend.read(collection, '123456789012', this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              non_existing_doc = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expect(errors[0].http_status).toBe(404)
          expect(non_existing_doc).toBeNull()

      it "creates and reads documents", ->
        key_from_response = null
        read_document = null
        runs ->
          Step(
            () ->
              backend.create(collection, {some_attribute: 'abc'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              key_from_response = key.toString()
              backend.read(collection, key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
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
        listing = []
        runs ->
          Step(
            () ->
              backend.list(collection,
                (doc) ->
                  log.error("unexpected document: #{doc}")
                  listing.push doc
              ,this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("list end -> error, list: #{error}, #{JSON.stringify(listing)}")
              errors.push error
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()
          expect(listing.length).toEqual(0)
 
      it "lists a collection", ->
        keys = []
        listing = []
        key_from_listing = null
        read_document = null
        runs ->
          Step(
            () ->
              backend.create(collection, {some_attribute: 'abc'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              keys[0] = key.toString()
              backend.create(collection, {some_attribute: 'xyz'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              keys[1] = key.toString()
              backend.list(collection,
                (doc) ->
                  log.debug("document: #{doc}")
                  listing.push doc
              ,this)
            ,
             (error) ->
              if (logIntermediateResults)
                log.info("list -> error, list: #{error}, #{JSON.stringify(listing)}")
              errors.push error
              # one extra step (which do not really belong into this spec):
              # use key from listing to read single document
              key_from_listing = listing[0]._id.toString()
              backend.read(collection, key_from_listing, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              read_document = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()

          # the listing might be in any order, not neccessarily in the order in
          # which we created the entries.
          expect(listing.length).toBe(2)
          fromListing = []
          fromListing[0] = findInArray listing, keys[0]
          fromListing[1] = findInArray listing, keys[1]
          expect(fromListing[0]).toBeDefined()
          expect(fromListing[0]._id.toString()).toEqual(keys[0])
          expect(fromListing[0]['some_attribute']).toEqual('abc')
          expect(fromListing[1]).toBeDefined()
          expect(fromListing[1]._id.toString()).toEqual(keys[1])
          expect(fromListing[1]['some_attribute']).toEqual('xyz')
          expect(read_document).toBeDefined()
          if (read_document._id.toString() == keys[0])
            expect(fromListing[0]).toEqual(read_document)
          else if (read_document._id.toString() == keys[1])
            expect(fromListing[1]).toEqual(read_document)
          else
            this.fail("id of read document neither matched the key of the first nor of the second created document")

      it "says 404 when updating a non-existing document", ->
        runs ->
          Step(
            () ->
              backend.update(collection, '123456789012', {second_attribute: 123, third_attribute: 456}, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("update -> error: #{error}")
              errors.push error
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expect(errors[0].http_status).toBe(404)


      it "updates a document", ->
        key_from_response = null
        read_document = null
        runs ->
          Step(
            () ->
              backend.create(collection, {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              key_from_response = key.toString()
              backend.update(collection, key_from_response, {second_attribute: 123, third_attribute: 'baz'}, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("update -> error: #{error}")
              errors.push error
              backend.read(collection, key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
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
              backend.create(collection, {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              key_from_response = key.toString()
              backend.read(collection, key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              read_document_before_remove = doc
              backend.remove(collection, key_from_response, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("remove -> error: #{error}")
              errors.push error
              backend.read(collection, key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              read_document_after_remove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3].http_status).toBe(404)
          expect(read_document_before_remove).not.toBeNull()
          expect(read_document_after_remove).toBeNull()

      it "removes a document twice while being idempotent", ->
        key_from_response = null
        read_document_after_remove = null
        runs ->
          Step(
            () ->
              backend.create(collection, {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              key_from_response = key.toString()
              backend.remove(collection, key_from_response, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("remove -> error: #{error}")
              errors.push error
              backend.remove(collection, key_from_response, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("remove -> error: #{error}")
              errors.push error
              backend.read(collection, key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              read_document_after_remove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3].http_status).toBe(404)
          expect(read_document_after_remove).toBeNull()

      it "does not return a document from a removed collection", ->
        key_from_response = null
        read_document_before_remove = null
        read_document_after_remove = null
        runs ->
          Step(
            () ->
              backend.create(collection, {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              key_from_response = key.toString()
              backend.read(collection, key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              read_document_before_remove = doc
              backend.removeCollection(collection, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("removeCollection -> error: #{error}")
              errors.push error
              backend.read(collection, key_from_response, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              read_document_after_remove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3].http_status).toBe(404)
          expect(read_document_before_remove).not.toBeNull()
          expect(read_document_after_remove).toBeNull()


      ###
      HELPER FUNCTIONS
      ###
 
      expectNoErrors = () ->
        expectNoError(i, error) for error, i in errors[0..errors.length - 1]

      expectNoError = (index, error) ->
        expect(error == null || error == undefined).toBe(true)
        if ! (error == null || error == undefined) 
          log.error("Unexpected error in test: [#{index}]: #{error}")

      findInArray = (array, id) ->
        for item in array
          if (item._id.toString() == id.toString())
            return item

  ###
  Call all parameterized tests
  ###

  parameterized('../../backends/node_dirty_backend', 'node-dirty')
  parameterized('../../backends/nstore_backend', 'nStore')
  # for the MongoDB integration tests, the MongoDB has to run (obviously)
  parameterized('../../backends/mongodb_backend', 'MongoDB')

