describe "Integration test: storra", ->

  log = require('../log')
  Step = require('step')

  baseUrl = 'http://localhost:1302'

  router = null
  requests = []
  responses = []

  beforeEach ->
    # TODO parameterize this test like backend_integration spec with all possible backends
    global.storra_config = {core: {backend: './backends/node_dirty_backend'}}
    router = require '../router'

    requests = []
    responses = []
 
  it "responds to OPTIONS / with 200", ->
    forOptions '/', (response) ->
      expectOptionsResponse response

  it "responds to GET / with 400", ->
    forGet '/', (response) ->
      expect(response.status).toEqual(400)
      expect(response.body[0]).toMatch(/This is storra, the REST document store./)
      expect(response.body).toContain('GET / to display this text,\n')

  it "responds to POST / with 501 (not implemented)", ->
    forPost '/', (response) ->
      expect(response.status).toEqual(501)

  it "responds to PUT / with 501 (not implemented)", ->
    forPut '/', (response) ->
      expect(response.status).toEqual(501)

  it "responds to DELETE / with 501 (not implemented)", ->
    forDelete '/', (response) ->
      expect(response.status).toEqual(501)

  it "responds to OPTIONS /collection with 200 OK", ->
    forOptions '/collection', (response) ->
      expectOptionsResponse response

  # TODO This is very questionable. The colletion is created on demand and the
  # response is 200 with an empty collection, though the collection did not
  # exist before this request. 404 might be preferable. OTOH, some do behave
  # just like this, so we would need to check for existence before every list/
  # query by other means, which might have an performance impact.
  it "responds to GET /collection with 200 if collection does not exist - though 404 might be preferable", ->
    forGet '/non-existing-collection', (response) ->
      expect(response.status).toEqual(200)
      expect(response.body).toEqual(["[]"])

  it "responds to GET /collection with 200 if collection exists and has a document", ->
    forRequests [
      new MockRequest('POST', '/collection', '{"a": "b"}')
      new MockRequest('GET', '/collection')
    ], (response) ->
      expect(responses[0].status).toEqual(201)
      expect(responses[1].status).toEqual(200)
      expect(responses[1].body[0]).toContain('[{"a":"b","_id":')

  it "responds to PUT /collection with 501 (not implemented)", ->
    forPut '/collection', (response) ->
      expect(response.status).toEqual(501)

  it "responds 204 when deleting a non-existing collection (idempotent)", ->
    forDelete '/collection', (response) ->
      expect(response.status).toEqual(204)

  it "deletes an entire collection on DELETE /collection", ->
    forRequests [
      new MockRequest('POST', '/collection', '{"a": "b"}')
      new MockRequest('GET', '/collection')
      new MockRequest('DELETE', '/collection')
      new MockRequest('GET', '/collection')
    ], (response) ->
      expect(responses[0].status).toEqual(201)
      expect(responses[1].status).toEqual(200)
      expect(responses[1].body[0]).toContain('[{"a":"b","_id":')
      expect(responses[2].status).toEqual(204)
      expect(responses[3].body[0]).not.toContain('[{"a":"b","_id":')

  it "responds to OPTIONS /collection/key with 200 OK", ->
    forOptions '/collection/key', (response) ->
      expectOptionsResponse response

  it "responds to GET /collection/key with 404 if document does not exist", ->
    forGet '/collection/non-existing-doc', (response) ->
      expect(response.status).toEqual(404)
      expect(response.body[0]).toContain('The requested resource was not found.')

  it "responds to GET /collection/key with 200 if documents exists", ->
    location = null
    forRequests [
      new MockRequest('POST', '/collection', '{"a": "b"}', null, (response) ->
        location = response.headers['Location']
      )
      new MockRequest('GET', 'will be set by "after" handler', null, (request) ->
        request.url = location
      , null)
    ], (response) ->
      expect(responses[0].status).toEqual(201)
      expect(responses[1].status).toEqual(200)
      expect(responses[1].body[0]).toContain('{"a":"b","_id":')

  it "responds to POST /collection/key with 501 (not implemented)", ->
    forPost '/collection/key', (response) ->
      expect(response.status).toEqual(501)

  it "responds to PUT /collection/key with 404 for a non-existing document", ->
    forPut('/collection/non-existing-document', (response) ->
      expect(response.status).toEqual(404)
    , '{"a": "b"}'
    )

  it "updates an existing document", ->
    location = null
    forRequests [
      new MockRequest('POST', '/collection', '{"a": "b"}', null, (response) ->
        location = response.headers['Location']
      )
      new MockRequest('PUT', 'ignored', '{"x": "y"}', (request) ->
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
      expect(responses[2].body[0]).not.toContain('"a"')
      expect(responses[2].body[0]).not.toContain('"b"')

  it "responds 204 when deleting a non-existing document (idempotent)", ->
    forDelete '/collection/key', (response) ->
      expect(response.status).toEqual(204)

  it "deletes a document on DELETE /collection/key", ->
    location = null
    forRequests [
      new MockRequest('POST', '/collection', '{"a": "b"}', null, (response) ->
        location = response.headers['Location']
      )
      new MockRequest('GET', 'ignored', null, (request) ->
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
      if requests[i].after
        requests[i].after(responses[i])
    waitsFor ->
      return responses[i] && responses[i].ended
    , "request to have returned", 200
 
  forOptions = (path, responseCheck) ->
    forSingleRequest('OPTIONS', path, responseCheck)

  forGet = (path, responseCheck) ->
    forSingleRequest('GET', path, responseCheck)

  forPost = (path, responseCheck, body) ->
    forSingleRequest('POST', path, responseCheck, body)

  forPut = (path, responseCheck, body) ->
    forSingleRequest('PUT', path, responseCheck, body)

  forDelete = (path, responseCheck) ->
    forSingleRequest('DELETE', path, responseCheck)

  forSingleRequest = (method, path, responseCheck, body) ->
    requests[0] = new MockRequest(method, path, body)
    responses[0] = new MockResponse()
    runs ->
      router.route requests[0], responses[0]
      if (requests[0].body)
        requests[0].listener['data'](requests[0].body)
        requests[0].listener['end']()
    waitsFor ->
      return responses[0] && responses[0].ended
    , "request to have ended", 200
    runs ->
      responseCheck(responses[0])

  expectOptionsResponse = (response) ->
    expect(response.status).toEqual(200)
    expect(response.headers["Access-Control-Allow-Origin"]).toEqual("*")
    expect(response.headers["Access-Control-Allow-Headers"]).toEqual("X-Requested-With, Access-Control-Allow-Origin, X-HTTP-Method-Override, Content-Type, Authorization, Accept")
    expect(response.headers["Access-Control-Allow-Methods"]).toEqual("POST, GET, PUT, DELETE, OPTIONS")
    expect(response.headers["Access-Control-Allow-Credentials"]).toBe(true)
    expect(response.headers["Access-Control-Max-Age"]).toEqual("86400")

  class MockRequest
    constructor: (@method, path, @body, @before, @after) ->
      @url = baseUrl + path
      @headers = {host: 'localhost'}
      @listener = []

    on: (event, callback) ->
      @listener[event] = callback
 
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

