/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      ' * <%= pkg.home %>\n' +
      ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
      ' *\n' +
      ' * This Executable Form is subject to the terms of the Mozilla Public\n' +
      ' * License, v. 2.0. If a copy of the MPL was not distributed with this\n' +
      ' * file, You can obtain one at http://mozilla.org/MPL/2.0/.\n' +
      ' */\n',
    // Task configuration.
    //concat: {
    //  options: {
    //    banner: '<%= banner %>',
    //    stripBanners: true
    //  },
    //  dist: {
    //    src: ['lib/*.js', 'bower_components/d3/d3.js', 'bower_components/topojson/topojson.js', 'main-browser.js'],
    //    dest: 'bundle.js'
    //  }
    //},
    uglify: {
      options: {
        banner: '<%= banner %>'
      },
      dist: {
        src: 'bundle.js',
        dest: 'bundle.min.js'
      }
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        unused: true,
        boss: true,
        eqnull: true,
        browser: true,
        globals: {
          jQuery: true,
          module: true,
          require: true
        }
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      main: {
        src: 'main.js'
      }
    },
    qunit: {
      files: ['test/**/*.html']
    },
    browserify: {
      dist: {
        files: {
          'bundle.js': 'main.js'
        }
      }
    },
    watch: {
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: ['jshint:gruntfile']
      },
      lib_test: {
        files: '<%= jshint.main.src %>',
        //tasks: ['jshint:lib_test', 'qunit']
        tasks: 'build'
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-browserify');

  // Default task.
  grunt.registerTask('build', ['browserify', 'uglify']);
  grunt.registerTask('default', ['jshint', 'qunit', 'build']);

};
