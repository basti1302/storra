# This spec tests all backend connectors without mocking/spying their
# dependencies. That is, it truely accesses the database used by the connector.
# In case of the MongoDB backend connector, MongoDB needs to be up and running
# for this spec to succeed.
describe "Common backend integration test:", ->

  TIMEOUT = 5000

  log = require('../../lib/log')
  Step = require('step')
  uuid = require('node-uuid')
  wire = require('wire')
  relativizr = new (require('../../lib/relativizr'))()

  logIntermediateResults = true

  # define parameterized test
  parameterized = (backendModule, backendName) ->
    describe "The #{backendName} backend (without mocked dependencies)", ->

      backend = null
      finished = false
      errors = []
      collection = null

      standardWaitsFor = () ->
        return finished
      waitForStepsToFinish = () -> waitsFor(standardWaitsFor,
          "all steps finishing", TIMEOUT)

      beforeEach ->
        backend = null
        finished = false
        errors = []
        collection = null

        TestConfigReader = require('../test_config_reader')
        configReader = new TestConfigReader()

        # When wiring has finished, we fetch the backend connector from the
        # wire.js context
        afterWiring = (context) ->
          backend = context.backend
          backend.init(configReader)
          log.debug(be + ' has been wired.')
          backend.checkAvailable(
            () ->
              log.debug("Backend #{backendName} is available.")
            ,
            (err) ->
              # If the backend under test is not there, we just kill the node.js
              # process to immediately stop the test run. This is extremely
              # questionable, but right now it helps - otherwise you'll get a
              # lot of failures in the test run and wonder what on earth is
              # going wrong. It would be nice if Jasmine offered a version of
              # the fail method that also stops the current spec (right now,
              # jasmine just continues with the spec and reports all failures at
              # the end).
              log.error(err)
              log.error("Backend #{backendName} is not available, killing test
                  process!")
              process.exit(1)
          )

        # Wire up the test wire.js context
        runs ->
          backendSpec = "#{backendModule}_wire_spec"
          relativizr.wireRelative(backendSpec, afterWiring)

        # wait for wiring to be finished (by looking if backend has been set by
        # afterWiring)
        waitsFor ->
          backend
        , "wire context to have been initialized", 500

        collection = uuid.v1()

      afterEach ->
        log.debug("afterEach: closing connection")
        backend.removeCollection collection, (err) ->
          if (err)
            log.error(err)
        backend.closeConnection (err) ->
          if (err)
            log.error(err)

      it "says 409 when creating the same collection twice", ->
        runs ->
          Step(
            () ->
              backend.createCollection(collection, this)
            (error) ->
              backend.createCollection(collection, this)
            (error) ->
              errors.push error
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expect(errors[0]).toBeTruthy()
          expect(errors[0].httpStatus).toBeTruthy()
          expect(errors[0].httpStatus).toBe(409)

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
        nonExistingDoc = null
        runs ->
          Step(
            () ->
              backend.read(collection, '123456789012', this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              nonExistingDoc = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expect(errors[0].httpStatus).toBe(404)
          expect(nonExistingDoc).toBeNull()

      it "creates and reads documents", ->
        keyFromResponse = null
        readDocument = null
        runs ->
          Step(
            () ->
              backend.create(collection, {some_attribute: 'abc'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              keyFromResponse = key.toString()
              backend.read(collection, keyFromResponse, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              readDocument = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()
          expect(readDocument).toBeDefined()
          expect(readDocument['some_attribute']).toEqual('abc')

      it "says 404 when listing a non-existing collection collection", ->
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
                log.info("list end -> error, list: #{error},
                    #{JSON.stringify(listing)}")
              errors.push error
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expect(errors[0].httpStatus).toBe(404)
          expect(listing.length).toEqual(0)

      it "creates an empty collection and lists it", ->
        listing = []
        runs ->
          Step(
            () ->
              backend.createCollection(collection, this)
            (error) ->
              backend.list(collection,
                (doc) ->
                  log.error("unexpected document: #{doc}")
                  listing.push doc
              ,this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("list end -> error, list: #{error},
                    #{JSON.stringify(listing)}")
              errors.push error
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()
          expect(listing.length).toEqual(0)

      it "lists a non-empty collection", ->
        keys = []
        listing = []
        keyFromListing = null
        readDocument = null
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
                log.info("list -> error, list: #{error},
                    #{JSON.stringify(listing)}")
              errors.push error
              # one extra step (which does not really belong into this spec):
              # use key from listing to read single document
              keyFromListing = listing[0]._id.toString()
              backend.read(collection, keyFromListing, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              readDocument = doc
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
          expect(readDocument).toBeDefined()
          if (readDocument._id.toString() == keys[0])
            expect(fromListing[0]).toEqual(readDocument)
          else if (readDocument._id.toString() == keys[1])
            expect(fromListing[1]).toEqual(readDocument)
          else
            this.fail("id of read document neither matched the key of the
                first nor of the second created document")

      it "says 404 when updating a non-existing document", ->
        runs ->
          Step(
            () ->
              backend.update(collection, '123456789012',
                  {second_attribute: 123, third_attribute: 456}, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("update -> error: #{error}")
              errors.push error
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expect(errors[0].httpStatus).toBe(404)


      it "updates a document", ->
        keyFromResponse = null
        readDocument = null
        runs ->
          Step(
            () ->
              backend.create(collection, {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              keyFromResponse = key.toString()
              backend.update(collection, keyFromResponse,
                  {second_attribute: 123, third_attribute: 'baz'}, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("update -> error: #{error}")
              errors.push error
              backend.read(collection, keyFromResponse, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              readDocument = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoErrors()
          expect(readDocument).not.toBeNull()
          expect(readDocument.first_attribute).toBeUndefined()
          expect(readDocument.second_attribute).toEqual(123)
          expect(readDocument.third_attribute).toEqual('baz')

      it "removes a document", ->
        keyFromResponse = null
        readDocumentBeforeRemove = null
        readDocumentAfterRemove = null
        runs ->
          Step(
            () ->
              backend.create(collection, {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              keyFromResponse = key.toString()
              backend.read(collection, keyFromResponse, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              readDocumentBeforeRemove = doc
              backend.remove(collection, keyFromResponse, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("remove -> error: #{error}")
              errors.push error
              backend.read(collection, keyFromResponse, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              readDocumentAfterRemove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3].httpStatus).toBe(404)
          expect(readDocumentBeforeRemove).not.toBeNull()
          expect(readDocumentAfterRemove).toBeNull()

      it "removes a document twice while being idempotent", ->
        keyFromResponse = null
        readDocumentAfterRemove = null
        runs ->
          Step(
            () ->
              backend.create(collection, {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              keyFromResponse = key.toString()
              backend.remove(collection, keyFromResponse, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("remove -> error: #{error}")
              errors.push error
              backend.remove(collection, keyFromResponse, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("remove -> error: #{error}")
              errors.push error
              backend.read(collection, keyFromResponse, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              readDocumentAfterRemove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3].httpStatus).toBe(404)
          expect(readDocumentAfterRemove).toBeNull()

      it "does not return a document from a removed collection", ->
        keyFromResponse = null
        readDocumentBeforeRemove = null
        readDocumentAfterRemove = null
        runs ->
          Step(
            () ->
              backend.create(collection, {first_attribute: 'foobar'}, this)
            ,
            (error, key) ->
              if (logIntermediateResults)
                log.info("create -> error, key: #{error}, #{key}")
              errors.push error
              keyFromResponse = key.toString()
              backend.read(collection, keyFromResponse, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              readDocumentBeforeRemove = doc
              backend.removeCollection(collection, this)
            ,
            (error) ->
              if (logIntermediateResults)
                log.info("removeCollection -> error: #{error}")
              errors.push error
              backend.read(collection, keyFromResponse, this)
            ,
            (error, doc, key) ->
              if (logIntermediateResults)
                log.info("read -> error, doc, key: #{error}, #{doc}, #{key}")
              errors.push error
              readDocumentAfterRemove = doc
              finished = true
          )
        waitForStepsToFinish()
        runs ->
          expectNoError(i, error) for error, i in errors[0..2]
          expect(errors[3].httpStatus).toBe(404)
          expect(readDocumentBeforeRemove).not.toBeNull()
          expect(readDocumentAfterRemove).toBeNull()


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

  parameterized('./backends/node_dirty_backend', 'node-dirty')
  parameterized('./backends/nstore_backend', 'nStore')
  # for the MongoDB integration tests, MongoDB has to run (obviously)
  parameterized('./backends/mongodb_backend', 'MongoDB')

