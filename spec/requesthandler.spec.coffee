describe "The request handler", ->

  sandbox = null
  storage = null
  requesthandler = null
  response = null

  beforeEach ->
    sandbox = require 'sandboxed-module'
    storage = jasmine.createSpyObj('storage', [
      'list'
      'removeCollection'
      'read'
      'create'
      'update'
    ])
    response = jasmine.createSpyObj('response', [
      'writeHead'
      'write'
      'end'
    ])

    requesthandler = sandbox.require '../requesthandler', 
      requires:
        './storage': storage

  it "responds to root with 400 Bad Request", -> 
    requesthandler.root({}, response)
    expectResponse 400
    expect(response.write).toHaveBeenCalled()
    expect(response.end).toHaveBeenCalled()

  it "handles OPTIONS requests", -> 
    requesthandler.options({}, response)
    expectResponse 200
    #  OPTIONS response has no body
    expect(response.write).not.toHaveBeenCalled()
    expect(response.end).toHaveBeenCalled()

  it "serves a collection of documents", -> 
    # pseudocode - maybe via jsMockito? 
    # when(storage.list(collection, callback).thenDoInstead
    #  callback()

    requesthandler.list({}, response, 'collection')
    expect(storage.list).toHaveBeenCalledWith 'collection', jasmine.any(Function)
    # callback is not called via storage list because it is just a spy
    # expect(response.writeHead).toHaveBeenCalled()
    # expect(response.write).toHaveBeenCalled()
    # expect(response.end).toHaveBeenCalled()
  
  expectResponse = (status) ->
    expect(response.writeHead).toHaveBeenCalledWith(status, jasmine.any(Object)) 
