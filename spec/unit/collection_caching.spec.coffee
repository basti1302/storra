describe "The collection cache", ->

  Cache = null
  cache = null

  beforeEach ->
    Cache = require('../../lib/backends/collection_cache')
    cache = new Cache()

  it "returns null for a collection that is not in the cache", ->
    collection = cache.get('does-not-exist')
    expect(collection).toBeUndefined()

  it "returns the collection from the cache", ->
    collectionIn = {foo: 'bar'}
    cache.put('collection', collectionIn)
    collectionOut = cache.get('collection')
    expect(collectionOut).toBe(collectionIn)
    expect(collectionOut['foo']).toEqual('bar')

  it "increases the cache size after putting", ->
    expect(cache.size).toEqual(0)
    cache.put('x', {})
    expect(cache.size).toEqual(1)
    cache.put('y', {})
    expect(cache.size).toEqual(2)
    cache.put('z', {})
    expect(cache.size).toEqual(3)
    
  it "does not increases the cache size when overwriting", ->
    expect(cache.size).toEqual(0)
    cache.put('x', {})
    expect(cache.size).toEqual(1)
    cache.put('x', {})
    expect(cache.size).toEqual(1)
    cache.put('x', {})
    expect(cache.size).toEqual(1)

  it "removes entries", ->
    cache.put('x', {})
    expect(cache.get('x')).not.toBeNull()
    expect(cache.get('x')).not.toBeUndefined()
    cache.remove('x')
    expect(cache.get('x')).toBeUndefined()

  it "knows the lru order when putting", ->
    cache.put('x', {})
    expect(cache.lru.tail.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.key).toEqual('x')

    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.previous.key).toEqual('x')
    expect(cache.lru.tail.key).toEqual('y')

    cache.put('z', {})
    expect(cache.lru.tail.previous.previous.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.previous.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.previous.previous.key).toEqual('x')
    expect(cache.lru.tail.previous.key).toEqual('y')
    expect(cache.lru.tail.key).toEqual('z')

  it "knows the correct lru order when overwriting", ->
    cache.put('x', {})
    cache.put('y', {})
    cache.put('z', {})
    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.previous.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.previous.previous.key).toEqual('x')
    expect(cache.lru.tail.previous.key).toEqual('z')
    expect(cache.lru.tail.key).toEqual('y')

  it "knows the correct lru order when overwriting the first", ->
    cache.put('x', {})
    cache.put('y', {})
    cache.put('x', {})
    expect(cache.lru.tail.previous.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.previous.key).toEqual('y')
    expect(cache.lru.tail.key).toEqual('x')
  
  it "knows the correct lru order when overwriting the last", ->
    cache.put('x', {})
    cache.put('y', {})
    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.previous.key).toEqual('x')
    expect(cache.lru.tail.key).toEqual('y')

  it "knows the correct lru order when overwriting the only entry", ->
    cache.put('x', {})
    cache.put('x', {})
    expect(cache.lru.tail.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.key).toEqual('x')

  it "knows the correct lru order when getting", ->
    cache.put('x', {})
    cache.put('y', {})
    cache.put('z', {})

    cache.get('y')
    cache.get('z')
    cache.get('y')
    cache.get('x')
    cache.get('x')

    expect(cache.lru.tail.previous.previous.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.previous.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.previous.previous.key).toEqual('z')
    expect(cache.lru.tail.previous.key).toEqual('y')
    expect(cache.lru.tail.key).toEqual('x')

  it "knows the correct lru order when putting, overwriting and getting", ->
    cache.put('x', {})
    cache.get('y')
    cache.get('z')
    cache.put('y', {})
    cache.put('x', {})
    cache.put('z', {})

    expect(cache.lru.tail.previous.previous.previous.previous).toBeUndefined()
    expect(cache.lru.tail.previous.previous.previous.key).toEqual(cache.lru.headVal)
    expect(cache.lru.tail.previous.previous.key).toEqual('y')
    expect(cache.lru.tail.previous.key).toEqual('x')
    expect(cache.lru.tail.key).toEqual('z')

  it "evicts the least recently used collection when the cache limit is hit", ->
    cache = new Cache(3)
    in1 = {one: 1}
    in2 = {two: 2}
    in3 = {three: 3}
    in4 = {four: 4}
    cache.put('1', in1)
    cache.put('2', in2)
    cache.put('3', in3)
    cache.get('1')
    cache.get('3')
    cache.put('4', in4)
    expect(cache.get('1')).toEqual(in1)
    expect(cache.get('2')).toBeUndefined()
    expect(cache.get('3')).toEqual(in3)
    expect(cache.get('4')).toEqual(in4)

