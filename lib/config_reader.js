require('js-yaml')

var log = require('./log')

module.exports = ConfigurationReader

function ConfigurationReader() {

  function recursiveMerge(configuration, defaults) {
    for (key in defaults) {
      var defaultValue = defaults[key]
      if (typeof defaults[key] == 'object') {
        if (!configuration[key] || typeof configuration[key] != 'object') {
          configuration[key] = {}
        }
        recursiveMerge(configuration[key], defaults[key]) 
      } else if (typeof defaults[key] != 'function') {
        if (!configuration[key]) {
          configuration[key] = defaults[key]
        } 
      }
    }
  }

  this.read = function(filename) {
    /* load configuration from yaml */
    try {
      var configuration = require(filename);
    } catch (err) {
      log.error(err)
      log.warn('Could not find configuration file ' + filename + ', will use default configuration values.')
      return
    }
  
    /* use defaults for configuration values that have not been configured */
    recursiveMerge(configuration, getDefaults())
    log.debug('Core configuration (read from ' + filename + ', merged with defaults):\n' + JSON.stringify(configuration))

    /* make configuration object globally visible */
    global.storra_config = configuration
    var merge = recursiveMerge
    global.storra_config.mergeDefaults = function(defaults) {
      merge(global.storra_config, defaults)
    }
  }

  function getDefaults() {
    return {
      core: {
        port: 1302,
        bind_address: '0.0.0.0',
        backend: './backends/node_dirty_backend'
      }
    }
  }
}



