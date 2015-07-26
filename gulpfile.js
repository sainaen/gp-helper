var gulp = require("gulp");
var clean = require("gulp-clean");
var browserify = require("browserify");
var source = require("vinyl-source-stream");

gulp.task("js", function () {
	return browserify("src/js/app.js", {debug: true})
		.bundle()
		.pipe(source("app.js"))
		.pipe(gulp.dest("build/js"));
});

gulp.task("files", function () {
	return gulp.src("src/files/**/*")
		.pipe(gulp.dest("build"));
});

gulp.task("clean", function () {
	return gulp.src("build")
		.pipe(clean());
});

gulp.task("default", ["clean"], function () {
	gulp.start("js", "files");
});

gulp.task("watch", ["default"], function () {
	gulp.watch("src/js/**/*.js", ["js"]);
	gulp.watch("src/files/**/*", ["files"]);
});
