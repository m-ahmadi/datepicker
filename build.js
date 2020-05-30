const { writeFileSync, readFileSync, existsSync, readdirSync, statSync, unlinkSync } = require('fs');
const { join, dirname, extname, delimiter } = require('path');
const { execSync } = require('child_process');
const chokidar = require('chokidar');
const indent = require('indent.js');
process.env.path += delimiter + './node_modules/.bin';

colors();
const log = console.log;
const args = process.argv.slice(2);
args.includes('js')         ? runJs() :
args.includes('html')       ? runHtml() :
args.includes('temp')       ? runTemp() :
args.includes('rtl')        ? runRtlcss() :

args.includes('js-w')       ? watch('./public/js/**/*.js', runJs) :
args.includes('html-w')     ? watch('./html/**/*', runHtml) :
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
	const temps = '<script src="${c.root}/lib/_templates.js"></script>\n';
	const live = existsSync('.livereload') ? '\n'+ readFileSync('.livereload', 'utf8') : '';
	
	const modulepreloads = depGraph.map(i => '<link rel="modulepreload" href="${c.root}/'+i+'" />').join('\n');
	const app = depGraph.map(i => '<script type="module" src="${c.root}/'+i+'"></script>').join('\n');
	
	writeFileSync('./html/link-modulepreload/index.tmpl', modulepreloads);
	writeFileSync('./html/script-app/index.tmpl', temps + app + live);
	log('Ran js.'.green);
}

function getDependencyGraph(entry, files, result=[]) {
	if (entry) files = [entry = join(entry)];
	for (const file of files) {
		const content = readFileSync(file, 'utf8');
		const matchesIterator = content.matchAll(/import.+from\s+'(.+)'/g);
		let matches = [];
		for (const match of matchesIterator) {
			const groups = match.slice(1).map( i => join(dirname(file), i) );
			matches.push(...groups);
		}
		if (matches.length) {
			result.push(...matches);
			getDependencyGraph(undefined, matches, result);
		}
	}
	if (entry) return [entry, ...new Set(result)].map(i => i.replace(/\\/g, '/'));
}
//@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
// html
function runHtml() {
	const rootDir     = './html';
	const outFile     = './public/index.html';
	const tempFile    = 'index.tmpl';
	const	dataFileExt = '.htm';
	const tree = dirTree(rootDir, dataFileExt);
	const html = parseAndRender(tree, {tempFile, dataFileExt});
	if (!html) return;
	writeFileSync(outFile, indent.html(html, {tabString: '  '}), 'utf8');
	log('Ran html.'.green);
}

function parseAndRender(node, settings) {
	const dirs = getDirs(node);
	if (dirs.length) {
		dirs.forEach(k => {
			if (getDirs(node[k]).length) {
				node[k] = parseAndRender(node[k], settings);
			} else {
				node[k] = render(node[k], settings);
			}
		});
	}
	return render(node, settings);
}
function getDirs(node) {
	return Object.keys(node).filter(k => Object.prototype.toString.call(node[k]) === '[object Object]');
}
function render(node, settings) {
	const files     = Object.keys(node).filter( k => ['function','string'].includes(typeof node[k]) );
	const tempFile  = files.find(k => k === settings.tempFile);
	const dataFiles = files.filter(k => !extname(k) || extname(k) === settings.dataFileExt);
	let result = '';
	if (tempFile) {
		const context = dataFiles.reduce((a,c) => (a[c.replace(extname(c), '')] = node[c]) && a, {});
		result = node[tempFile](context);
	} else {
		result = dataFiles.reduce((a,c) => a += node[c]+'\n', '');
	}
	return result;
}
function dirTree(dir, dataFileExt, tree={}) {
	readdirSync(dir).forEach(file => {
		const path = join(dir, file);
		if ( statSync(path).isDirectory() ) {
			tree[file] = {};
			dirTree(path, dataFileExt, tree[file]);
		} else {
			tree[file] = extname(file) === dataFileExt
				? readFileSync(path, 'utf8')
				: eval("(c={}) => `"+ readFileSync(path, 'utf8') +"`");
			//: eval("(c={}) => { eval('var {'+Object.keys(c).join()+'} = c;'); return `"+ readFileSync(path, 'utf8') +"`; }");
		}
	});
	return tree;
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
	log('livereload started...'.magentaB);
}

function toggleManualLivereload() {
	const port = Math.floor(Math.random()*(65000-36000+1))+36000;
	const str = `<script>document.write('<script src=\"http://' + (location.host || 'localhost').split(':')[0] + ':${port}/livereload.js?snipver=1\"></' + 'script>')</script>`;
	const file = '.livereload';
	if ( existsSync(file) ) {
		unlinkSync(file);
		log('Off'.redB);
	} else {
		writeFileSync(file, str);
		log('On'.greenB);
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
	runHtml();
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
		log('Watching...'.magentaB, path.whiteB);
	});
}

function colors() {
	[
		['green',    32],
		['redB',     91],
		['greenB',   92],
		['magentaB', 95],
		['whiteB',   97],
	].forEach(([k, n]) => {
		String.prototype.__defineGetter__(k, function () {
			return `[${n}m${this}[0m`;
		});
	});
}