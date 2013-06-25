'use strict';

var log = require('../log')

function LinkedKeyMap() {
  this.map = {}
  this.headVal = {}
  this.head = this.tail = new LinkedKeyMapNode(undefined, this.headVal)

  this.moveToTail = function(key) {
    this.remove(key)
    this.append(key)
  }

  this.append = function(key) {
    var newNode = new LinkedKeyMapNode(this.tail, key)
    this.tail.next = newNode
    this.tail = newNode
    this.map[key] = newNode
  }
 
  this.has = function(key) {
    return !!this.map[key]
  }

  this.remove = function(key) {
    if (!this.has(key)) { return }
    var node = this.map[key]
    if (node.next) {
      node.next.previous = node.previous
    } 
    if (node.previous) {
      node.previous.next = node.next
    }
    if (node === this.tail) {
      this.tail = node.previous
    }
    delete(this.map[key])
  }

  this.dump = function() {
    log.debug('LRU: ')
    var n = this.head
    while (n) {
      var s = ''
      if (n.previous) {
        s += '[' + n.previous.key + '] ->'
      } else {
        s += '0 ->'
      }
      s += ' [' + n.key + '] '
      if (n.next) {
        s += '-> [' + n.next.key + ']'
      } else {
        s += '-> 0'
      }
      log.debug(s)
      n = n.next
    }
  }

  function LinkedKeyMapNode(previous, key) {
    this.previous = previous
    this.key = key
    this.next = null
  }
}

function Cache(capacity) {
  this.cache = {}
  if (capacity) {
    this.capacity = capacity
  } else {
    this.capacity = 1000
  }
  this.size = 0
  this.lru = new LinkedKeyMap()
}

module.exports = Cache

Cache.prototype.get = function(key) {
  var node = this.cache[key]
  if (node) {
    this.lru.moveToTail(key)
  }
  return node
}

Cache.prototype.put = function(key, entry) {
  if (!this.cache[key]) {
    this.size++
  }
  this.cache[key] = entry
  this.lru.moveToTail(key)
  if (this.size > this.capacity) {
    var toEvict = this.lru.head.next
    delete this.cache[toEvict.key]
    this.lru.remove(this.lru.head.next.key)
  }
  // this.lru.dump()
}

Cache.prototype.remove = function(key) {
  if (!this.cache[key]) { return }
  this.lru.remove(key)
  delete this.cache[key]
}

