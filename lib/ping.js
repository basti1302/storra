'use strict';

var request = require('request')

exports.ping = function(uri, callback) {

  // TODO Instead of accessing / and checking for status 400 we should have a
  // special resource like /_storra/status or /_storra/health to access, which
  // a) returns 200 if all is fine and
  // b) also checks if the configured storrage backend is up and runnin.

  if (!uri) {
    uri = 'http://localhost:1302/'
  }
  request.get(uri, function(error, response) {
    if (error) {
      callback(error)
    } else if (response.statusCode === 400) {
      callback()
    } else {
      callback(new Error('HTTP status code was not 400 (as expected), but ' +
          response.statusCode))
    }
  })
}
