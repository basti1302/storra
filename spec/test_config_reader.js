module.exports = TestConfigurationReader

function TestConfigurationReader() {
  this.createGlobalConfig = function() {
    global.storra_config = {
      mergeDefaults: function(defaults) {
        for (key in defaults) {
          global.storra_config[key] = defaults[key]
        }
      }
    }
  }
}



