var http = require("http");
var url = require("url");
var queryString = require("querystring");
var torrent = require("./torrent");
var bencoder = require("./bencoder");
var compact = require("./compact");
var bufferUtils = require("./buffer-utils");

var listenPort = 8124;

torrent.openFile('bad_teacher.torrent', function(error, info) {

	var list = info['announce-list'];

	function run() {
		if (list.length <= 0) {
			return; 
		}
		
		var nextUrl = list.pop(); 
			nextUrl = nextUrl.pop(); // each url is stored inside a single value array. 
		query(nextUrl, info, run);
	}

	run();
});


function query(trackerUrl, info, callback) {
	trackerUrl =  url.parse(trackerUrl);

	if (trackerUrl.protocol != 'http:') {
		console.log('skipping: ' + trackerUrl.href);
		return callback();
	}

	console.log("\n\n");
	console.log('requesting: ' + trackerUrl.href);

	var data = {
		peer_id: 'qwertyuiopasdfghjxla',
		port: listenPort,
		uploaded: 0,
		downloaded: 0,
		numwant: 50, /* default value */
		compact: 1
	};

	var binaryHash = new Buffer(info.info_hash, 'hex');

	var options = {
		host: trackerUrl.hostname,
		port: trackerUrl.port,
		path: trackerUrl.pathname + '?' + queryString.stringify(data) + '&info_hash=' + bufferUtils.encodeToHttp(binaryHash),
		method: 'GET'
	};

	console.log('data', options);
	
	var request = http.request(options, function(response) {
		response.setEncoding('binary');

		var data = '';

		response.on('data', function(chunk) {
			data += chunk;
		});
		response.on('end', function() {
			data = bencoder.decode(data);
			console.log('response', data);
			console.log(compact.decode(data.peers));
			callback();
		});

	});

	request.on('error', function(error) {
		console.log('error', error.message);
		callback();
	});
	
	request.end();
}