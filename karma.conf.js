module.exports = function(config) {
  config.set({
    basePath: '',
    autoWatch: true,
    frameworks: ['mocha'],
    files: [
      '_built2/dbproto.js',
      'node_modules/chai/chai.js',
      'test/*.js'
    ],
    plugins: [
        'karma-coverage',
        'karma-mocha',
        'karma-firefox-launcher'
    ],

    browsers: ['Firefox'] ,

    reporters: ['progress'/*, 'coverage'*/],
    //preprocessors: { 'dist/dbproto.js': ['coverage'] },

    singleRun: false,

    coverageReporter: {
        dir : 'coverage/',
        reporters: [
            { type: 'html', subdir: 'html' },
            { type: 'lcovonly', subdir: 'lcov' },
            { type: 'cobertura', subdir: 'cobertura' }
        ]
    }

  });
};