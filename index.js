#!/usr/bin/env node

'use strict'

/*
 * main js file of nstore-rest-server.
 * Use "node index.js" to start the server.
 */

/* configuration */
global.nstore_rest_server_port = 8888
global.nstore_rest_server_bind_address = "0.0.0.0"

var server = require("./server")

server.start()
