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

    // Task configuration.
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
      extensions: 'coffee',
      forceExit: true,
      useCoffee: true,
      jUnit: {
        report: false,
        savePath : './build/reports/jasmine/',
        useDotNotation: true,
        consolidate: true
      }
    },
    // TODO Also run cucumber.js features? But then we need to make sure a
    // storra process is running.
    watch: {
      files: ['<%= jshint.files %>', '<%= coffeelint.specs %>'],
      tasks: ['default']
    },
  })

  grunt.loadNpmTasks('grunt-contrib-jshint')
  grunt.loadNpmTasks('grunt-coffeelint')
  grunt.loadNpmTasks('grunt-jasmine-node')
  grunt.loadNpmTasks('grunt-contrib-watch')

  grunt.registerTask('default', ['jshint', 'coffeelint', 'jasmine_node'])

  // Travis-CI task
  grunt.registerTask('travis', ['default'])
}
/* jshint +W106 */
