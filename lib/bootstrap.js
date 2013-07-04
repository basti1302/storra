/*
 * Starts storra by creating the wire.js context
 */
var wire = require('wire');
wire(require('./wire_spec'), { require: require }).then(null, console.error)
