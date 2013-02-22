describe "Integration test: storra", ->

  router = null
  request = null
  response = null

  beforeEach ->
    global.storra_backend = './backends/node_dirty_backend'
    router = require '../router' 

    request = {
      method: 'GET'
      url: 'http://localhost:8888/'
    }
    response = {
      status: null
      headers: [] 
      body: []
      ended: false
      writeHead: (status, headers) ->
        this.status = status
        this.headers = headers
      write: (chunk) ->
        this.body.push(chunk)
      end: ->
        this.ended = true
    }
 
  it "answers GET / with 400", ->
    router.route request, response
    expect(response.status).toEqual(400)
    expect(response.body[0]).toMatch(/This is storra, the REST document store./)
    expect(response.body).toContain('GET / to display this text,\n')
    expect(response.ended).toBe(true) 

  it "answers GET /collection/document with 404 if document does not exist", ->
    request.url = 'http://localhost:8888/collection/non-existing-doc'
    runs ->
      router.route request, response
    waitsFor ->
      return response.ended
    , "request to have ended", 100
    runs ->
      expect(response.ended).toBe(true) 
      expect(response.status).toEqual(404)
      expect(response.body).toContain('The requested resource was not found.')

  # TODO: More integration test cases 
