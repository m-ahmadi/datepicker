const { writeFileSync, readFileSync, existsSync, readdirSync, statSync, unlinkSync } = require('fs');
const { join, parse, extname, delimiter } = require('path');
const { execSync } = require('child_process');
const chokidar = require('chokidar');
process.env.path += delimiter + './node_modules/.bin';

colors();
const log = console.log;
const args = process.argv.slice(2);
args.includes('js')         ? runJs() :
args.includes('temp')       ? runTemp() :
args.includes('rtl')        ? runRtlcss() :

args.includes('js-w')       ? watch('./public/js/**/*.js', runJs) :
args.includes('temp-w')     ? watch('./template/**/*.htm', runTemp) :
args.includes('rtl-w')      ? watch('./public/css/style.css', runRtlcss) :

args.includes('live')       ? live() :
args.includes('toggleLive') ? toggleManualLivereload() :

args.includes('release')    ? release() :
debug();
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// js
function runJs() {
	const depGraph = getDependencyGraph('./public/js/main.js').map(i=>i.replace('public/','')).reverse();
	const temps = '<script src="{{root}}/lib/_templates.js"></script>\n';
	const live = existsSync('.livereload') ? '\n'+ readFileSync('.livereload', 'utf8') : '';
	
	const modulepreloads = depGraph.map(i => `<link rel="modulepreload" href="{{root}}/${i}" />`).join('\n');
	const app = depGraph.map(i => `<script type="module" src="{{root}}/${i}"></script>`).join('\n');
	
	writeFileSync('./html/link-modulepreload/index.hbs', modulepreloads);
	writeFileSync('./html/script-app/index.hbs', temps + app + live);
	log('Ran js.'.green);
}

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
function runTemp() {
	const dir = getFiles('./template/');
	let str = 'const _templates = {};\n';
	dir.forEach(path => {
		const key = path.replace('template/', '').replace(extname(path), '');
		str += "_templates['"+key+"'] = function (c={}) { return `"+ readFileSync(path, 'utf8') + "` };\n";
	});
	writeFileSync('./public/lib/_templates.js', str);
	log('Ran templates.'.green);
}

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
function runRtlcss() {
	const res = execSync('rtlcss ./public/css/style.css ./public/css/style-rtl.css');
	log('Ran rtlcss.'.green, res.stdout || '');
	// echo {"map": true} > .rtlcssrc
}
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// livereload
function live() {
	const livereload = require('livereload');
	const port = existsSync('.livereload') && readFileSync('.livereload', 'utf8').match(/:(\d+)\/livereload.js\?snipver=1/)[1];
	const lrserver = livereload.createServer({...port && {port}});

	lrserver.watch(
		[
			'./public/index.html',
			'./public/css/**/*.css',
			'./public/js/**/*.js',
			'./public/lib/_*'
		].map( i => join(__dirname, i) )
	);
	log('livereload started...'.bMagenta);
}

function toggleManualLivereload() {
	const port = Math.floor(Math.random()*(65000-36000+1))+36000;
	const str = `<script>document.write('<script src=\"http://' + (location.host || 'localhost').split(':')[0] + ':${port}/livereload.js?snipver=1\"></' + 'script>')</script>`;
	const file = '.livereload';
	if ( existsSync(file) ) {
		unlinkSync(file);
		log('Off'.bRed);
	} else {
		writeFileSync(file, str);
		log('On'.bGreen);
	}
}
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// full builds
function full() {
	const SRC = '.';
	const DEST = './public';
	const ROOT = '.';
	
	writeFileSync(SRC+'/html/link-modulepreload/root.htm', ROOT);
	writeFileSync(SRC+'/html/link-stylesheet/root.htm', ROOT);
	writeFileSync(SRC+'/html/script-lib/root.htm', ROOT);
	writeFileSync(SRC+'/html/script-app/root.htm', ROOT);
	writeFileSync(DEST+'/js/gen/root.js', `export default '${ROOT}';`);
	
	runJs();
	log( execSync(`htmlbilder ${SRC}/html/ -o ${DEST}/index.html -t index.hbs`)+'' );
	runTemp();
	log( execSync(`sass ${SRC}/scss/style.scss:${DEST}/css/style.css`)+'' );
}

function release() {
	// TODO
}
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// util
function watch(path, fn, init=true) {
	init && fn();
	const watcher = chokidar.watch(path).on('ready', () => {
		watcher
			.on('add', fn)
			.on('addDir', fn)
			.on('unlink', fn)
			.on('unlinkDir', fn)
			.on('change', fn);
		log('Watching...'.bMagenta, path.bWhite);
	});
}

function colors() {
	[
		['green',    32],
		['bRed',     91],
		['bGreen',   92],
		['bMagenta', 95],
		['bWhite',   97],
	].forEach(([k, n]) => {
		String.prototype.__defineGetter__(k, function () {
			return `[${n}m${this}[0m`;
		});
	});
}