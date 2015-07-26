const gulp = require("gulp");
const del = require("del");
const browserify = require("browserify");
const src = require("vinyl-source-stream");

const source = "src";
const target = "build";

gulp.task("js", function () {
    return browserify({entries: `${source}/js/app.js`, debug: true})
        .bundle()
        .pipe(src("app.js"))
        .pipe(gulp.dest(`${target}/js`));
});

gulp.task("files", function () {
    return gulp.src(`${source}/files/**/*`)
        .pipe(gulp.dest(target));
});

gulp.task("clean", function (cb) {
    del(target, cb);
});

gulp.task("default", ["clean"], function () {
    gulp.start("js", "files");
});

gulp.task("watch", ["default"], function () {
    gulp.watch(`${source}/js/**/*.js`, ["js"]);
    gulp.watch(`${source}/files/**/*`, ["files"]);
});
