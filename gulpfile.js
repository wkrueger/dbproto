var gulp = require('gulp'),
    plugins = require('gulp-load-plugins')(),
    merge = require('merge2');

gulp.task('build' , () => {

    var tsStream = plugins.typescript({
        target : 'es5' ,
        declaration : true
    })

    gulp.src('dbproto.ts').pipe(tsStream);
    return merge([
        tsStream.js.pipe(gulp.dest('dist')) ,
        tsStream.dts.pipe(gulp.dest('.'))
        ]);

})


var Server = require('karma').Server;

/**
 * Run test once and exit
 */
gulp.task('test', function (done) {
  new Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done).start();
});