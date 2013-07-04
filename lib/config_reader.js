'use strict';

require('js-yaml')

var log = require('./log')

function ConfigurationReader() {

  var self = this

  /*
   * Merges all values from defaults into the given configuration.
   * If configuration already has the key, it will *not* be overwritten with the
   * corresponding value from defaults.
   */
  function recursiveMerge(configuration, defaults) {
    // iterate through all key-value-pairs in defaults
    for (var key in defaults) {
      if (defaults.hasOwnProperty(key)) {
        var defaultValue = defaults[key]
        // if it is an object... (that is, a non-leave in the config tree)
        if (typeof defaultValue === 'object') {
          // ... and not present in the current configuration...
          if (!configuration[key] || typeof configuration[key] !== 'object') {
            // ... we create an empty array in the current configuration
            configuration[key] = {}
          }
          // ... and recurse deeper into the structure
          recursiveMerge(configuration[key], defaults[key])
        // primitive values (strings, numbers, ..., everything that is neither
        // object or function) are handled here: If it is not present in the
        // current configuration we merge it.
        } else if (typeof defaultValue !== 'function') {
          if (!configuration[key]) {
            configuration[key] = defaults[key]
          }
        }
      }
    }
  }

  this.read = function(filename) {
    /* load configuration from yaml */
    try {
      this.configuration = require(filename);
    } catch (err) {
      this.configuraiton = {}
      log.error(err)
      log.warn('Could not find configuration file %s, will use default ' +
          'configuration values.', filename)
      return
    }

    /* use defaults for configuration values that have not been configured */
    recursiveMerge(this.configuration, getDefaults())
    log.debug('Core configuration (read from %s, merged with defaults):\n',
        filename, this.configuration)

    // TODO Is this a responsibility of the config reader or of the config
    // object? This also decides wether to inject the config reader or only the
    // config object into other components.
    var merge = recursiveMerge
    this.mergeDefaultsIntoCurrentConfiguration =
        function(defaults) {
      merge(self.configuration, defaults)
    }
  }

  function getDefaults() {
    return {
      core: {
        port: 1302,
        bindAddress: '0.0.0.0',
        backend: './backends/node_dirty_backend'
      }
    }
  }
}

module.exports = ConfigurationReader
