# This spec tests the node-dirty backend without mocking/spying node-dirty or any
# other dependencies, that is, it truely accesses the node-dirty in-memory db and
# even lets node-dirty persist to disk.
describe "The node-dirty backend (without mocked dependencies)", ->

  Step = require('step')

  backend = null
  finished = false
  key1 = null
  key2 = null
  listing = null
  read1 = null
  read2 = null
  read3 = null
  read4 = null

  beforeEach ->
    backend = require '../backends/node_dirty_backend',
    finished = false

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
  it "creates, persists, lists, updates, retrieves and removes entries", ->
    runs ->
      Step(
        () ->
          backend.removeCollection('test', this)
        ,
        (error) ->
          backend.create('test', {some_attribute: 'abc'}, this)
        ,
        (error, key) ->
          key1 = key
          backend.create('test', {some_attribute: 'xyz'}, this)
        ,
        (error, key) ->
          key2 = key
          backend.list('test', this)
        ,
        (error, results) ->
          listing = results
          backend.read('test', key1, this)
        ,
        (error, doc, key) ->
          read1 = doc
          backend.read('test', key2, this)
        ,
        (error, doc, key) ->
          read2 = doc
          backend.update('test', key1, {some_attribute: 123, another_attribute: 456}, this)
        ,
        (error) ->
          backend.read('test', key1, this)
        (error, doc, key) ->
          read3 = doc
          backend.remove('test', key2, this)
        (error) ->
          backend.read('test', key2, this)
        (error, doc, key) ->
          read4 = doc
          finished = true
      )
    
    waitsFor(() ->
      return finished
    , "all steps finishing", 200)
    runs ->
      expect(key1).not.toBe(null)
      expect(key2).not.toBe(null)
      console.log("LST: " + JSON.stringify(listing))
      expect(listing[key1]).toEqual({some_attribute: 'abc'})
      expect(listing[key2]).toEqual({some_attribute: 'xyz'})
      expect(read1).toEqual({some_attribute: 'abc'})
      expect(read2).toEqual({some_attribute: 'xyz'})
      expect(read3).toEqual({some_attribute: 123, another_attribute: 456})
      expect(read4).toBeNull()

