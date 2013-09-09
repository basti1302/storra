# This spec tests a larger part of Storra, though not the complete application.
# Test calls begin at router.js, thus leaving out bootstrap and server.js out
# of the equation. The backends are not mocked, so real database backends are
# used. Like backend.spec.coffee, this spec is parameterized and will be
# executed once for each backend.
describe "Integration from routing to backend test:", ->

  log = require('../../lib/log')
  Step = require('step')
  uuid = require('node-uuid')
  wire = require('wire')

  # define parameterized test
  parameterized = (backendModule, backendName) ->

    baseUrl = 'http://localhost:1302'
    testWireSpec = require('./test_wire_spec')

    collectionName = null
    collectionUrl = null
    keyName = null
    keyUrl = null

    router = null
    requests = []
    responses = []

    describe "Storra (with the #{backendName} backend)", ->
      beforeEach ->
        # TODO remove dupliction between production wire spec and test spec

        router = null
        requests = []
        responses = []

        # two step wiring - first the root context which only contains the
        # parameter which backend is to be used. If that has finished, wire
        # test_wire_spec.js as a child context.
        afterParamWiring = (paramContext) ->
          # When wiring has finished, we fetch the router from the wire.js
          # context
          afterWiring = (context) ->
            router = context.router
          # Wire the test wire.js context
          paramContext.wire(testWireSpec,
              { require: require }).then(afterWiring, console.error)

        runs ->
          # trigger param/root context wiring, which will implicitly trigger
          # wiring of test_wire_spec
          wire({ backend: "./backends/#{backendModule}_backend" },
               {require: require}).then(afterParamWiring, console.log)

        # wait for all wiring to be finished (by looking if router has been set
        # by afterWiring)
        waitsFor ->
          router
        , "wire context to have been initialized", 500

        collectionName = uuid.v1()
        collectionUrl = "/#{collectionName}"
        keyName = '123456789012'
        keyUrl = "#{collectionUrl}/#{keyName}"

        requests = []
        responses = []

      afterEach ->
        cleanupRequest = null
        cleanupResponse = null
        runs ->
          cleanupRequest = new MockRequest('DELETE', collectionUrl)
          cleanupResponse = new MockResponse()
          router.route cleanupRequest, cleanupResponse
        waitsFor ->
          return cleanupResponse.ended
        , "initial delete request to have ended", 200
        runs ->
          expect(cleanupResponse.status).toEqual(204)

      it "responds to OPTIONS / with 200", ->
        forOptions '/', (response) ->
          expectOptionsResponse response

      it "responds to GET / with 400", ->
        forGet '/', (response) ->
          expect(response.status).toEqual(400)
          expect(response.body[0])
            .toMatch(/This is storra, the REST data store./)
          expect(response.body).toContain('GET / to display this text,\n')

      it "creates a collection on POST to /", ->
        forRequests [
          new MockRequest('POST', '/', '{"name": "' + collectionName + '"}')
          new MockRequest('GET', collectionUrl)
        ], (response) ->
          expect(responses[0].status).toEqual(201)
          expect(responses[1].status).toEqual(200)
          expect(responses[1].body[0]).toEqual('[')
          expect(responses[1].body[1]).toEqual(']')

      it "responds to POST / with 409, if collection already exists", ->
        forRequests [
          new MockRequest('POST', '/', '{"name": "' + collectionName + '"}')
          new MockRequest('POST', '/', '{"name": "' + collectionName + '"}')
        ], (response) ->
          expect(responses[0].status).toEqual(201)
          expect(responses[1].status).toEqual(409)

      it "responds to POST / with 400, if no POST data is present", ->
        forPostWithEmptyBody '/', (response) ->
          expect(responses[0].status).toEqual(400)

      # create collection - body has no name attribute
      it "responds to POST / with 400,
if no collection name has been supplied", ->
        forPost '/', (response) ->
          expect(response.status).toEqual(400)
        , '{"sadness": "no name attribute present"}'

      it "responds to PUT / with 501 (not implemented)", ->
        forPut '/', (response) ->
          expect(response.status).toEqual(501)

      it "responds to DELETE / with 501 (not implemented)", ->
        forDelete '/', (response) ->
          expect(response.status).toEqual(501)

      it "responds to OPTIONS /collection with 200 OK", ->
        forOptions collectionUrl, (response) ->
          expectOptionsResponse response

      it "responds to GET /collection with 404
 if collection does not existt", ->
        forGet collectionUrl, (response) ->
          expect(response.status).toEqual(404)
          expect(response.body[0]).toContain(
            'The requested resource was not found.')

      it "responds to GET /collection with 200 if collection exists and has a
          document", ->
        forRequests [
          new MockRequest('POST', collectionUrl, '{"a": "b"}')
          new MockRequest('GET', collectionUrl)
        ], (response) ->
          expect(responses[0].status).toEqual(201)
          expect(responses[1].status).toEqual(200)
          expect(responses[1].body[0]).toEqual('[')
          expect(responses[1].body[1]).toContain('{"a":"b","_id":')
          expect(responses[1].body[2]).toEqual(']')

      # PUT /collection could be used to rename a collection
      it "responds to PUT /collection with 501 (not implemented)", ->
        forPut collectionUrl, (response) ->
          expect(response.status).toEqual(501)

      it "responds 204 when deleting a non-existing collection (idempotent)", ->
        forDelete collectionUrl, (response) ->
          expect(response.status).toEqual(204)

      it "deletes an entire collection on DELETE /collection", ->
        forRequests [
          new MockRequest('POST', collectionUrl, '{"a": "b"}')
          new MockRequest('GET', collectionUrl)
          new MockRequest('DELETE', collectionUrl)
          new MockRequest('GET', collectionUrl)
        ], (response) ->
          expect(responses[0].status).toEqual(201)
          expect(responses[1].status).toEqual(200)
          expect(responses[1].body[1]).toContain('{"a":"b","_id":')
          expect(responses[2].status).toEqual(204)
          expect(responses[3].status).toEqual(404)

      it "responds to OPTIONS /collection/key with 200 OK", ->
        forOptions keyUrl, (response) ->
          expectOptionsResponse response

      it "responds to GET /collection/key with 404
          if document does not exist", ->
        # caution: for MongoDB, key must be 12 bytes long
        # doesnotexist is 12 bytes long :-)
        forGet '/collection/doesnotexist', (response) ->
          expect(response.status).toEqual(404)
          expect(response.body[0]).toContain(
            'The requested resource was not found.')

      it "responds to GET /collection/key with 200 if documents exists", ->
        location = null
        forRequests [
          new MockRequest('POST',
            collectionUrl, '{"a": "b"}', null, (response) ->
              location = response.headers['location']
          )
          new MockRequest('GET',
            'will be set by before handler', null, (request) ->
              request.url = location
          , null)
        ], (response) ->
          expect(responses[0].status).toEqual(201)
          expect(responses[1].status).toEqual(200)
          expect(responses[1].body[0]).toContain('{"a":"b","_id":')

      it "responds to POST /collection/key with 501 (not implemented)", ->
        forPost keyUrl, (response) ->
          expect(response.status).toEqual(501)

      it "responds to PUT /collection/key with 404
          for a non-existing document", ->
        # caution: for MongoDB, key must be 12 bytes long
        # doesnotexist is 12 bytes long :-)
        forPut('/collection/doesnotexist', (response) ->
          expect(response.status).toEqual(404)
        , '{"c": "d"}'
        )

      it "updates an existing document", ->
        location = null
        forRequests [
          new MockRequest('POST',
            collectionUrl, '{"e": "f"}', null, (response) ->
              location = response.headers['location']
          )
          new MockRequest('PUT',
            'ignored', '{"x": "y"}', (request) ->
              request.url = location
          )
          new MockRequest('GET', 'ignored', null, (request) ->
            request.url = location
          )
        ], (response) ->
          expect(responses[0].status).toEqual(201)
          expect(responses[1].status).toEqual(204)
          expect(responses[2].status).toEqual(200)
          expect(responses[2].body[0]).toContain('{"x":"y","_id":')
          expect(responses[2].body[0]).not.toContain('"e"')
          expect(responses[2].body[0]).not.toContain('"f"')

      it "responds 204 when deleting a non-existing document (idempotent)", ->
        forDelete keyUrl, (response) ->
          expect(response.status).toEqual(204)

      it "deletes a document on DELETE /collection/key", ->
        location = null
        forRequests [
          new MockRequest('POST',
            collectionUrl, '{"a": "b"}', null, (response) ->
              location = response.headers['location']
          )
          new MockRequest('GET',
            'ignored', null, (request) ->
              request.url = location
          )
          new MockRequest('DELETE', 'ignored', null, (request) ->
            request.url = location
          )
          new MockRequest('GET', 'ignored', null, (request) ->
            request.url = location
          )
        ], (response) ->
          expect(responses[0].status).toEqual(201)
          expect(responses[1].status).toEqual(200)
          expect(responses[2].status).toEqual(204)
          expect(responses[3].status).toEqual(404)

      it "responds to OPTIONS /one/two/three with 404 (not found)", ->
        forOptions '/one/two/three', (response) ->
          expect(response.status).toEqual(404)

      it "responds to GET /one/two/three with 404 (not found)", ->
        forGet '/one/two/three', (response) ->
          expect(response.status).toEqual(404)

      it "responds to POST /one/two/three with 404 (not found)", ->
        forPost '/one/two/three', (response) ->
          expect(response.status).toEqual(404)

      it "responds to PUT /one/two/three with 404 (not found)", ->
        forPut '/one/two/three', (response) ->
          expect(response.status).toEqual(404)

      it "responds to DELETE /one/two/three with 404 (not found)", ->
        forDelete '/one/two/three', (response) ->
          expect(response.status).toEqual(404)


      forRequests = (requests, responseCheck) ->
        for i in [0...requests.length]
          executeRequestAndWaitForResponse(i, requests, responses)
        runs ->
          responseCheck()

      executeRequestAndWaitForResponse = (i, requests, respsonses) ->
        runs ->
          responses[i] = new MockResponse()
          if requests[i].before
            requests[i].before(requests[i])
          router.route(requests[i], responses[i])
          if (requests[i].body)
            requests[i].listener['data'](requests[i].body)
            requests[i].listener['end']()
        waitsFor ->
          ended = responses[i].ended
          if ended && requests[i].after
            requests[i].after(responses[i])
          return responses[i].ended
        , "request to have returned", 200

      forOptions = (path, responseCheck) ->
        forSingleRequest('OPTIONS', path, responseCheck)

      forGet = (path, responseCheck) ->
        forSingleRequest('GET', path, responseCheck)

      forPost = (path, responseCheck, body) ->
        forSingleRequest('POST', path, responseCheck, body)

      forPostWithEmptyBody = (path, responseCheck) ->
        forSingleRequest('POST', path, responseCheck, '')

      forPut = (path, responseCheck, body) ->
        forSingleRequest('PUT', path, responseCheck, body)

      forDelete = (path, responseCheck) ->
        forSingleRequest('DELETE', path, responseCheck)

      forSingleRequest = (method, path, responseCheck, body) ->
        requests[0] = new MockRequest(method, path, body)
        responses[0] = new MockResponse()
        runs ->
          router.route requests[0], responses[0]
          if (requests[0].body || requests[0].body == '')
            requests[0].listener['data'](requests[0].body)
            requests[0].listener['end']()
        waitsFor ->
          return responses[0] && responses[0].ended
        , "request to have ended", 200
        runs ->
          responseCheck(responses[0])

      expectOptionsResponse = (response) ->
        expect(response.status).toEqual(200)
        expect(response.headers["access-control-allow-origin"]).toEqual("*")
        expect(response.headers["access-control-allow-headers"])
            .toEqual("X-Requested-With, Access-Control-Allow-Origin,
 X-HTTP-Method-Override, Content-Type, Authorization, Accept")
        expect(response.headers["access-control-allow-methods"])
            .toEqual("POST, GET, PUT, DELETE, OPTIONS")
        expect(response.headers["access-control-allow-credentials"]).toBe(true)
        expect(response.headers["access-control-max-age"]).toEqual("86400")

      class MockRequest
        constructor: (@method, path, @body, @before, @after) ->
          @url = baseUrl + path
          @headers = {host: 'localhost'}
          @listener = []

        on: (event, callback) ->
          @listener[event] = callback
        once: (event, callback) ->
          @listener[event] = callback
        removeAllListeners: () ->
          @listeners = []


      class MockResponse
        constructor: () ->
          @status = null
          @headers = []
          @body = []
          @ended = false

        writeHead: (status, headers) ->
          @status = status
          @headers = headers

        write: (chunk) ->
          @body.push(chunk)

        end: ->
          @ended = true

      dumpResponse = (response) ->
        log.error(JSON.stringify(response))
  ###
  Call all parameterized tests
  ###

  parameterized('node_dirty', 'node-dirty')
  parameterized('nstore', 'nStore')
  # for the MongoDB integration tests, MongoDB has to run (obviously)
  parameterized('mongodb', 'MongoDB')

