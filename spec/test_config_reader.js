'use strict';

function TestConfigurationReader() {
  this.createGlobalConfig = function() {
    global.storraConfig = {
      mergeDefaults: function(defaults) {
        for (var key in defaults) {
          if (defaults.hasOwnProperty(key)) {
            global.storraConfig[key] = defaults[key]
          }
        }
      }
    }
  }
}

module.exports = TestConfigurationReader
