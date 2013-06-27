'use strict';

require('js-yaml')

var log = require('./log')

function ConfigurationReader() {

  function recursiveMerge(configuration, defaults) {
    for (var key in defaults) {
      if (defaults.hasOwnProperty(key)) {
        var defaultValue = defaults[key]
        if (typeof defaults[key] === 'object') {
          if (!configuration[key] || typeof configuration[key] !== 'object') {
            configuration[key] = {}
          }
          recursiveMerge(configuration[key], defaults[key])
        } else if (typeof defaults[key] !== 'function') {
          if (!configuration[key]) {
            configuration[key] = defaults[key]
          }
        }
      }
    }
  }

  this.read = function(filename) {
    /* load configuration from yaml */
    var configuration
    try {
      configuration = require(filename);
    } catch (err) {
      log.error(err)
      log.warn('Could not find configuration file ' + filename +
          ', will use default configuration values.')
      return
    }

    /* use defaults for configuration values that have not been configured */
    recursiveMerge(configuration, getDefaults())
    log.debug('Core configuration (read from ' + filename +
        ', merged with defaults):\n' + JSON.stringify(configuration))

    /* make configuration object globally visible */
    global.storraConfig = configuration
    var merge = recursiveMerge
    global.storraConfig.mergeDefaults = function(defaults) {
      merge(global.storraConfig, defaults)
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
