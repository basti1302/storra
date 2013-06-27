#!/usr/bin/env node

/*
 * main js file of storra.
 * Use "node index.js" to start the server.
 */

'use strict';

var startTime = Date.now()
var StorraServer = require('./lib/server')
var server = new StorraServer()
server.start(startTime)
