/*
 * Dead simple logging helper. Might be replaced by Winston or log4js later.
 */

var util = require('util')

function write(message) {
  util.log(message)
}
function debug(message) {
  write('[D] '+ message)
}
function info(message) {
  write('[I] '+ message)
}
function warn(message) {
  write('[W] '+ message)
}
function error(message) {
  write('[E] '+ message)
}

exports.debug = debug
exports.log = debug
exports.info = info
exports.warn = info
exports.error = error