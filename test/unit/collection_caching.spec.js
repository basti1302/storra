var chai = require('chai')
chai.should()
var expect = chai.expect

describe('The collection cache', function() {

  var Cache = require('../../lib/backends/collection_cache')
  var cache = null

  beforeEach(function() {
    cache = new Cache()
  })

  it('returns null for a collection that is not in the cache', function() {
    var collection = cache.get('does-not-exist')
    expect(collection).to.not.exist
  })

  it('returns the collection from the cache', function() {
    var collectionIn = {foo: 'bar'}
    cache.put('collection', collectionIn)
    var collectionOut = cache.get('collection')
    expect(collectionOut).to.equal(collectionIn)
    expect(collectionOut.foo).to.equal('bar')
  })

  it('increases the cache size after putting', function() {
    expect(cache.size).to.equal(0)
    cache.put('x', {})
    expect(cache.size).to.equal(1)
    cache.put('y', {})
    expect(cache.size).to.equal(2)
    cache.put('z', {})
    expect(cache.size).to.equal(3)
  })

  it('does not increases the cache size when overwriting', function() {
    expect(cache.size).to.equal(0)
    cache.put('x', {})
    expect(cache.size).to.equal(1)
    cache.put('x', {})
    expect(cache.size).to.equal(1)
    cache.put('x', {})
    expect(cache.size).to.equal(1)
  })

  it('removes entries', function() {
    cache.put('x', {})
    expect(cache.get('x')).to.exist
    cache.remove('x')
    expect(cache.get('x')).to.not.exist
  })

  it('knows the lru order when putting', function() {
    cache.put('x', {})
    expect(cache.lru.tail.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.key).to.equal(cache.lru.headVal)
    expect(cache.lru.tail.key).to.equal('x')

    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.previous.key).to.equal(cache.lru.headVal)
    expect(cache.lru.tail.previous.key).to.equal('x')
    expect(cache.lru.tail.key).to.equal('y')

    cache.put('z', {})
    expect(cache.lru.tail.previous.previous.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.previous.previous.key).to.equal(
      cache.lru.headVal)
    expect(cache.lru.tail.previous.previous.key).to.equal('x')
    expect(cache.lru.tail.previous.key).to.equal('y')
    expect(cache.lru.tail.key).to.equal('z')
  })

  it('knows the correct lru order when overwriting', function() {
    cache.put('x', {})
    cache.put('y', {})
    cache.put('z', {})
    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.previous.previous.key).to.equal(
      cache.lru.headVal)
    expect(cache.lru.tail.previous.previous.key).to.equal('x')
    expect(cache.lru.tail.previous.key).to.equal('z')
    expect(cache.lru.tail.key).to.equal('y')
  })

  it('knows the correct lru order when overwriting the first', function() {
    cache.put('x', {})
    cache.put('y', {})
    cache.put('x', {})
    expect(cache.lru.tail.previous.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.previous.key).to.equal(cache.lru.headVal)
    expect(cache.lru.tail.previous.key).to.equal('y')
    expect(cache.lru.tail.key).to.equal('x')
  })

  it('knows the correct lru order when overwriting the last', function() {
    cache.put('x', {})
    cache.put('y', {})
    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.previous.key).to.equal(cache.lru.headVal)
    expect(cache.lru.tail.previous.key).to.equal('x')
    expect(cache.lru.tail.key).to.equal('y')
  })

  it('knows the correct lru order when overwriting the only entry', function() {
    cache.put('x', {})
    cache.put('x', {})
    expect(cache.lru.tail.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.key).to.equal(cache.lru.headVal)
    expect(cache.lru.tail.key).to.equal('x')
  })

  it('knows the correct lru order when getting', function() {
    cache.put('x', {})
    cache.put('y', {})
    cache.put('z', {})

    cache.get('y')
    cache.get('z')
    cache.get('y')
    cache.get('x')
    cache.get('x')

    expect(cache.lru.tail.previous.previous.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.previous.previous.key).to.equal(
      cache.lru.headVal)
    expect(cache.lru.tail.previous.previous.key).to.equal('z')
    expect(cache.lru.tail.previous.key).to.equal('y')
    expect(cache.lru.tail.key).to.equal('x')
  })

  it('knows the correct lru order when putting, overwriting and getting', function() {
    cache.put('x', {})
    cache.get('y')
    cache.get('z')
    cache.put('y', {})
    cache.put('x', {})
    cache.put('z', {})

    expect(cache.lru.tail.previous.previous.previous.previous).to.not.exist
    expect(cache.lru.tail.previous.previous.previous.key).to.equal(
      cache.lru.headVal)
    expect(cache.lru.tail.previous.previous.key).to.equal('y')
    expect(cache.lru.tail.previous.key).to.equal('x')
    expect(cache.lru.tail.key).to.equal('z')
  })

  it('evicts the least recently used collection when the cache limit is hit', function() {
    cache = new Cache(3)
    var in1 = {one: 1}
    var in2 = {two: 2}
    var in3 = {three: 3}
    var in4 = {four: 4}
    cache.put('1', in1)
    cache.put('2', in2)
    cache.put('3', in3)
    cache.get('1')
    cache.get('3')
    cache.put('4', in4)
    expect(cache.get('1')).to.equal(in1)
    expect(cache.get('2')).to.not.exist
    expect(cache.get('3')).to.equal(in3)
    expect(cache.get('4')).to.equal(in4)
  })
})
