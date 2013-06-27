#!/usr/bin/env node

/*
 * main js file of storra.
 * Use "node lib/index.js" to start the server.
 */

'use strict';

var startTime = Date.now()
var StorraServer = require('./server')
var server = new StorraServer()
server.start(startTime)
