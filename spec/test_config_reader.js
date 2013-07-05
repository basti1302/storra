'use strict';

function TestConfigurationReader() {
  this.configuration = {}
  this.mergeDefaultsIntoCurrentConfiguration = function(defaults) {
    for (var key in defaults) {
      if (defaults.hasOwnProperty(key)) {
        this.configuration[key] = defaults[key]
      }
    }
  }
}

module.exports = TestConfigurationReader
