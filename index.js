#!/usr/bin/env node

'use strict'

/*
 * main js file of storra.
 * Use "node index.js" to start the server.
 */

/* configuration */
global.storra_port = 8888
global.storra_bind_address = "0.0.0.0"
// global.storra_backend = './backends/node_dirty_backend'
global.storra_backend = './backends/nstore_backend'

var server = require("./server")

server.start()
