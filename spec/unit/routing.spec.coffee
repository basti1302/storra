describe "Request routing:", ->

  sandbox = null
  requesthandler = null
  router = null

  beforeEach ->
    sandbox = require 'sandboxed-module'
    requesthandler = jasmine.createSpyObj('requesthandler', [
      'root'
      'options'
      'create'
      'list'
      'removeCollection'
      'retrieve'
      'update'
      'remove'
      'notImplemented'
      'notFound'
    ])

    router = sandbox.require '../../router', 
      requires:
        './requesthandler': requesthandler

  it "GET / is routed to root", -> 
    router.route get 'http://localhost/' 
    # requesthandler.root responds with 400 actually (plus additional info in response body
    expect(requesthandler.root).toHaveBeenCalled()
  
  it "POST / is routed to 503 Not Implemented", -> 
    router.route post 'http://localhost/' 
    expect(requesthandler.notImplemented).toHaveBeenCalled()
  
  it "GET /favicon.ico is routed to 404 Not Found", ->
    router.route get 'http://localhost/favicon.ico' 
    expect(requesthandler.notFound).toHaveBeenCalled()
 
  it "OPTIONS for any URL are routed to the options handler", ->
    router.route options 'http://localhost/' 
    expect(requesthandler.options).toHaveBeenCalled()
    router.route options 'http://localhost/collection' 
    expect(requesthandler.options).toHaveBeenCalled()
    router.route options 'http://localhost/collection/key' 
    expect(requesthandler.options).toHaveBeenCalled()
 
  it "GET /collection lists a collection", ->
    router.route get 'http://localhost/collection' 
    expect(requesthandler.list).toHaveBeenCalled()

  it "POST /collection creates a new document", ->
    router.route post 'http://localhost/collection'
    expect(requesthandler.create).toHaveBeenCalled()

  it "DELETE /collection deletes a collection", ->
    router.route remove 'http://localhost/collection'
    expect(requesthandler.removeCollection)

  it "GET /collection/key retrieves a document", ->
    router.route get 'http://localhost/collection/key' 
    expect(requesthandler.retrieve).toHaveBeenCalled()

  it "PUT /collection/key updates a document", ->
    router.route put 'http://localhost/collection/key'
    expect(requesthandler.update).toHaveBeenCalled()

  it "DELETE /collection/key removes a document", ->
    router.route remove 'http://localhost/collection/key' 
    expect(requesthandler.remove).toHaveBeenCalled()


  request = (url, method) ->
    req = 
      url: url
      method: method

  get = (url) ->
    request url, 'GET'

  post = (url) ->
    request url, 'POST'

  put = (url) ->
    request url, 'PUT'

  remove = (url) ->
    request url, 'DELETE'

  options = (url) ->
    request url, 'OPTIONS'
