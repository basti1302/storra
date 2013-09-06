'use strict';

/*
 * When triggering wire.js from a spec, all module paths contained in a wire
 * spec will be relative to the spec (like integration/some_spec.js) instead of
 * being relative to the lib directory (which is how it works when wiring from
 * production code). Thus, when using production wire specs from an integration
 * test spec, wire.js will not find the modules to wire. This is a workaround
 * for this.
 *
 * This module is not to be used from production code, only from tests/specs!
 */

var wire = require('wire')

function Relativizr() {
  this.wireRelative = function(wireSpec, callback) {
    wire(require(wireSpec), {require: require}).then(callback, console.log)
  }
}

module.exports = Relativizr
