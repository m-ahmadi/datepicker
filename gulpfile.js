const gulp = require('gulp');
const { readFileSync, writeFileSync, existsSync, readdirSync, statSync } = require('fs');
const { join, parse, extname, delimiter } = require('path');
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// js
gulp.task('js', cb => {
	const depGraph = getDependencyGraph('./public/js/main.js').map(i=>i.replace('public/','')).reverse();
	const temps = '<script src="{{root}}/lib/_templates.js"></script>\n';
	const live = existsSync('.livereload') ? '\n'+ readFileSync('.livereload', 'utf8') : '';
	
	const modulepreloads = depGraph.map(i => `<link rel="modulepreload" href="{{root}}/${i}" />`).join('\n');
	const app = depGraph.map(i => `<script type="module" src="{{root}}/${i}"></script>`).join('\n');
	
	writeFileSync('./html/link-modulepreload/index.hbs', modulepreloads);
	writeFileSync('./html/script-app/index.hbs', temps + app + live);
	cb();
});

gulp.task('js-w', () => {
	gulp.watch( './public/js/**/*.js', {ignoreInitial: false}, gulp.series('js') );
});

function getDependencyGraph(entry, files, result=[]) {
	if (entry) files = [entry = join(entry)];
	for (const file of files) {
		const content = readFileSync(file, 'utf8');
		const matches = content.matchAll(/import.+from\s+'(.+)'/g);
		for (const match of matches) {
			const groups = match.slice(1);
			const groupsJoined = groups.map( i => join(parse(file).dir, i) );
			result.push(...groupsJoined);
			if (groups.length) getDependencyGraph(undefined, groupsJoined, result);
		}
	}
	if (entry) return [entry, ...new Set(result)].map(i => i.replace(/\\/g, '/'));
}
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// templates
gulp.task('temp', cb => {
	const dir = getFiles('./template/');
	let str = 'const _templates = {};\n';
	dir.forEach(path => {
		const key = path.replace('template/', '').replace(extname(path), '');
		str += "_templates['"+key+"'] = function (c={}) { return `"+ readFileSync(path, 'utf8') + "` };\n";
	});
	writeFileSync('./public/lib/_templates.js', str);
	cb();
});

gulp.task('temp-w', () => {
	gulp.watch( './template/**/*.htm', {ignoreInitial: false}, gulp.series('temp') );
});

function getFiles(dir, res=[]) {
	const files = readdirSync(dir);
	for (let file of files) {
		file = join(dir, file);
		const stats = statSync(file);
		if ( stats.isDirectory() ) {
			getFiles(file, res);
		} else {
			res.push( file.replace(/\\/g, '/') );
		}
	}
	return res;
}
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// rtlcss
const { execSync } = require('child_process');
process.env.path += delimiter + './node_modules/.bin';

gulp.task('rtlcss', cb => {
	const res = execSync('rtlcss ./public/css/style.css ./public/css/style-rtl.css');
	console.log(res.stdout);
	cb();
});
// echo {"map": true} > .rtlcssrc
gulp.task('rtlcss-w', () => {
	gulp.watch( './public/css/style.css', {ignoreInitial: false}, gulp.series('rtlcss') );
});
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// livereload
const livereload = require('gulp-livereload');
const h = './public/index.html';
const c = './public/css/**/*.css';
const j = './public/js/**/*.js';
const l = './public/lib/_*';

const port = existsSync('.livereload') ? readFileSync('.livereload', 'utf8').match(/:(\d+)\/livereload.js\?snipver=1/)[1] : undefined;

gulp.task('live-html', cb => {
	gulp.src(h)
		.pipe( livereload() );
	cb();
});
gulp.task('live-css', cb => {
	gulp.src(c)
		.pipe( livereload() );
	cb();
});
gulp.task('live-js', cb => {
	gulp.src(j)
		.pipe( livereload() );
	cb();
});
gulp.task('live-lib', cb => {
	gulp.src(l)
		.pipe( livereload() );
	cb();
});
gulp.task('live', () => {
	livereload.listen(port ? {port} : undefined);
	
	gulp.watch( h, gulp.series('live-html') );
	gulp.watch( c, gulp.series('live-css') );
	gulp.watch( j, gulp.series('live-js') );
	gulp.watch( l, gulp.series('live-lib') );
});
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@