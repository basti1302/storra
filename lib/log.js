/*
 * Dead simple logging helper. Might be replaced by Winston or log4js later.
 */
'use strict';

var util = require('util')

function write(message) {
  util.log(message)
}
exports.log = exports.debug = function(message) {
  write('[D] '+ message)
}
exports.info = function(message) {
  write('[I] '+ message)
}
exports.warn = function(message) {
  write('[W] '+ message)
}
exports.error = function(message) {
  write('[E] '+ message)
}
