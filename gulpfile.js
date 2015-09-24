var gulp = require('gulp'),
    plugins = require('gulp-load-plugins')();

gulp.task('build' , () => {

    var tsStream = plugins.typescript({
        target : 'es5' ,
        declaration : true
    })

    gulp.src('dbproto.ts').pipe(tsStream).pipe(gulp.dest('dist'))

})