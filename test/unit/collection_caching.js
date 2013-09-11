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
    collectionOut.should.equal(collectionIn)
    collectionOut.foo.should.equal('bar')
  })

  it('increases the cache size after putting', function() {
    cache.size.should.equal(0)
    cache.put('x', {})
    cache.size.should.equal(1)
    cache.put('y', {})
    cache.size.should.equal(2)
    cache.put('z', {})
    cache.size.should.equal(3)
  })

  it('does not increases the cache size when overwriting', function() {
    cache.size.should.equal(0)
    cache.put('x', {})
    cache.size.should.equal(1)
    cache.put('x', {})
    cache.size.should.equal(1)
    cache.put('x', {})
    cache.size.should.equal(1)
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
    cache.lru.tail.previous.key.should.equal(cache.lru.headVal)
    cache.lru.tail.key.should.equal('x')

    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous).to.not.exist
    cache.lru.tail.previous.previous.key.should.equal(cache.lru.headVal)
    cache.lru.tail.previous.key.should.equal('x')
    cache.lru.tail.key.should.equal('y')

    cache.put('z', {})
    expect(cache.lru.tail.previous.previous.previous.previous).to.not.exist
    cache.lru.tail.previous.previous.previous.key.should.equal(
      cache.lru.headVal)
    cache.lru.tail.previous.previous.key.should.equal('x')
    cache.lru.tail.previous.key.should.equal('y')
    cache.lru.tail.key.should.equal('z')
  })

  it('knows the correct lru order when overwriting', function() {
    cache.put('x', {})
    cache.put('y', {})
    cache.put('z', {})
    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous.previous).to.not.exist
    cache.lru.tail.previous.previous.previous.key.should.equal(
      cache.lru.headVal)
    cache.lru.tail.previous.previous.key.should.equal('x')
    cache.lru.tail.previous.key.should.equal('z')
    cache.lru.tail.key.should.equal('y')
  })

  it('knows the correct lru order when overwriting the first', function() {
    cache.put('x', {})
    cache.put('y', {})
    cache.put('x', {})
    expect(cache.lru.tail.previous.previous.previous).to.not.exist
    cache.lru.tail.previous.previous.key.should.equal(cache.lru.headVal)
    cache.lru.tail.previous.key.should.equal('y')
    cache.lru.tail.key.should.equal('x')
  })

  it('knows the correct lru order when overwriting the last', function() {
    cache.put('x', {})
    cache.put('y', {})
    cache.put('y', {})
    expect(cache.lru.tail.previous.previous.previous).to.not.exist
    cache.lru.tail.previous.previous.key.should.equal(cache.lru.headVal)
    cache.lru.tail.previous.key.should.equal('x')
    cache.lru.tail.key.should.equal('y')
  })

  it('knows the correct lru order when overwriting the only entry', function() {
    cache.put('x', {})
    cache.put('x', {})
    expect(cache.lru.tail.previous.previous).to.not.exist
    cache.lru.tail.previous.key.should.equal(cache.lru.headVal)
    cache.lru.tail.key.should.equal('x')
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
    cache.lru.tail.previous.previous.previous.key.should.equal(
      cache.lru.headVal)
    cache.lru.tail.previous.previous.key.should.equal('z')
    cache.lru.tail.previous.key.should.equal('y')
    cache.lru.tail.key.should.equal('x')
  })

  it('knows the correct lru order when putting, overwriting and getting', function() {
    cache.put('x', {})
    cache.get('y')
    cache.get('z')
    cache.put('y', {})
    cache.put('x', {})
    cache.put('z', {})

    expect(cache.lru.tail.previous.previous.previous.previous).to.not.exist
    cache.lru.tail.previous.previous.previous.key.should.equal(
      cache.lru.headVal)
    cache.lru.tail.previous.previous.key.should.equal('y')
    cache.lru.tail.previous.key.should.equal('x')
    cache.lru.tail.key.should.equal('z')
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
    cache.get('1').should.equal(in1)
    expect(cache.get('2')).to.not.exist
    cache.get('3').should.equal(in3)
    cache.get('4').should.equal(in4)
  })
})
