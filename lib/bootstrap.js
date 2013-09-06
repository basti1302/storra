/*
 * Starts storra by creating the wire.js context
 */
var wire = require('wire')
// TODO replace the error handler with the winston logger or something
// that stops the node process if wiring isn't successfull
wire(require('./wire_spec'), { require: require }).then(null, console.error)
