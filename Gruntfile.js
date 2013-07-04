'use strict';

/* jshint -W106 */
module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> ' +
      '<%= pkg.author.name %>; Licensed ' +
      '<%= _.pluck(pkg.licenses, "type").join(", ") %> */  \n',

    jshint: {
      files: ['**/*.js', '.jshintrc', '!node_modules/**/*'],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    coffeelint: {
      options: {
        'arrow_spacing': { 'level': 'error' },
        'line_endings': { 'level': 'error' }
      },
      specs: ['spec/**/*.coffee']
    },
    jasmine_node: {
      options: {
        forceExit: true,
        match: '.',
        matchall: false,
        extensions: 'coffee',
        coffee: true,
        specNameMatcher: 'spec',
        jUnit: {
          report: false,
          savePath : './build/reports/jasmine/',
          useDotNotation: true,
          consolidate: true
        }
      },
      all: ['spec/'],
      unit: ['spec/unit/'],
      integration: ['spec/integration/']
    },
    cucumberjs: {
      files: 'features',
      options: {
        format: 'pretty'
      }
    },
    // TODO Also run cucumber.js features? But then we need to make sure a
    // storra process is running.
    watch: {
      files: ['<%= jshint.files %>', '<%= coffeelint.specs %>'],
      tasks: ['full']
    },
  })

  grunt.loadNpmTasks('grunt-contrib-jshint')
  grunt.loadNpmTasks('grunt-coffeelint')
  grunt.loadNpmTasks('grunt-jasmine-node')
  grunt.loadNpmTasks('grunt-cucumber')
  grunt.loadNpmTasks('grunt-contrib-watch')

  grunt.registerTask('start-storra', 'Start the storra server process.',
      function() {
    var done = this.async()
    require('./lib/ping').ping(null, function(error) {
      // Only start a local storra instance if none is running. Rationale:
      // If an instance is running via supervisor while watching changed files,
      // we do not need to (and can not due to port conflicts) start a second
      // instance.
      if (error) {
        grunt.log.writeln('It seems the storra server is currently not ' +
            'running, will start a new instance to run acceptance tests.')
        if (error.message !== 'connect ECONNREFUSED') {
          grunt.log.writeln('(Message from ping was: ' + error.message + ')')
        }
        require('./lib/bootstrap')
        done()
      } else {
        grunt.log.writeln('Storra server is already running.')
        done()
      }
    })
  })

  grunt.registerTask('default', ['jshint', 'coffeelint', 'jasmine_node:unit'])
  grunt.registerTask('integration', ['default', 'jasmine_node:integration'])
  grunt.registerTask('acceptance', ['start-storra', 'cucumberjs'])
  grunt.registerTask('full', ['integration', 'acceptance'])

  // Travis-CI task
  // grunt.registerTask('travis', ['default'])

}
/* jshint +W106 */
