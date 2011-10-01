var Router = require('router').create();
var EJS = require('ejs');
var FileSystem = require('fs');
var Step = require('step');
var Torrent = require('./../torrent');


// list all files inside the torrent.
Router.get('/torrent/{torrent}/?', function (request, response) {
	var filepath = './torrents/' + request.params.torrent;

	Step (
		function exists () {
			FileSystem.stat(filepath, this);
		},
		function decode (error, stats) {
			if (error) {
				response.end('unknown torrent file.');
				return;
			}

			Torrent.create(filepath, this);
		},
		function output (error, torrent) {
			render (response, 'torrent.ejs', {
				torrent: request.params.torrent,
				files: torrent.fileManager.files
			});
		}
	);
});

// stream the file to the response.
Router.get('/stream/{torrent}/{file}', function(request, response) {

	var filepath = './torrents/' + request.params.torrent;

	Step (
		function exists () {
			FileSystem.stat(filepath, this);
		},
		function decode (error, stats) {
			if (error) {
				response.end('unknown torrent file.');
				return;
			}

			Torrent.create(filepath, this);
		},
		function stream (error, torrent) {
			for (var i = 0; i < torrent.fileManager.files.length; i++) {
				var file = torrent.fileManager.files[i];
				if (file.path === unescape(request.params.file)) {
					file.pipe(response);
					file.download();
					break;
				}
			}
		}
	);

});

// list all torrent files.
Router.all('/', function(request, response) {
	Step(
		function readDirectory () {
			FileSystem.readdir('./torrents/', this);
		},
		function output (error, files) {
			render (response, 'all.ejs', {files: files});
		}
	);
});


function render(response, filepath, params) {
	Step(
		function template () {
			FileSystem.readFile('./web/views/' + filepath, 'utf8', this);
		},
		function render (error, template) {
			if (error) {
				callback(error);
				return;
			}

			var output = EJS.render(template, {locals: params});
			this(null, output);
		},
		function respond (error, output) {
			if (error) {
				response.end(error.message);
			}
			else {
				response.setHeader('Content-Type', 'text/html');
				response.write(output);
				response.end();
			}
		}
	);	
}

module.exports = Router;