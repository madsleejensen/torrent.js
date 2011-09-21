var Http = require('http');
var QueryString = require('querystring');
var Bencoder = require('bencoder');
var Compact = require('./../compact');
var Peer = require('./../peer');
var Events = require("events");
var U = require('U');

var MAXIMUM_FAILED_ATTEMPTS = 3;

exports.create = function HttpTracker (url) {
	
	var instance = new Events.EventEmitter();
	instance.url = url;
	instance.failed_attempts = 0;

	var mMinimumInterval = 60 * 1000;
	var mTorrent;
	var mIsRunning = false;
	var mIsWorking = false; // prevents multiple requests.
	var mTimeout;

	instance.start = function (torrent) {
		if (mIsRunning) return;
		mIsRunning = true;
		
		mTorrent = torrent;
		request(onRequestCompleted);
	};

	instance.forceUpdate = function () {
		if (mIsWorking) {
			return;
		}

		if (mTorrent == null) {
			return;
		}

		if (mTimeout != null) {
			clearTimeout(mTimeout);
		}

		//console.log('(force-request): http://%s%s', url.hostname, url.pathname);
		request(onRequestCompleted);
	};

	function request (callback) {
		if (mIsWorking) {
			callback();
		}
		mIsWorking = true;

		//console.log('(request): http://%s%s', url.hostname, url.pathname);

		var options = createRequestOptions(mTorrent);
		var request = Http.request(options, function(response) {
			response.setEncoding('binary');

			var data = '';

			response.on('data', function(chunk) {
				data += chunk;
			});

			response.on('end', function() {
				mIsWorking = false;
				handleResponse(data);
				callback();
			});
		});

		request.on('error', function(error) {
			callback(error);
		});

		request.end();	
	}

	function createRequestOptions (torrent) {
		var data = {
			peer_id: torrent.peer_id,
			port: 8123,
			uploaded: 0,
			downloaded: 0,
			numwant: 1000,
			compact: 1
		};

		return {
			host: url.hostname,
			port: url.port,
			path: url.pathname + '?' + QueryString.stringify(data) + '&info_hash=' + U.buffer.encodeToHttp(torrent.info_hash_buffer),
			method: 'GET'
		};
	}

	function handleResponse (data) {
		var peers = [];
		data = Bencoder.decode(data);

		if (data['min interval']) {
			mMinimumInterval = Math.max(5000, parseInt(data['min interval']) * 1000);
		}

		if (data.peers) {
			var rawPeers = Compact.decode(data.peers);
			rawPeers.forEach(function(connectionInfo) {
				var peer = Peer(connectionInfo);
				peers.push(peer);
			});
		}

		// console.log('(response): http://%s%s ( %d peers received ) will refresh in %d seconds', url.hostname, url.pathname, peers.length, mMinimumInterval / 1000);

		instance.failed_attempts = 0;
		instance.emit('new_peers', peers);
	}

	function onRequestCompleted (error) {
		if (error) {	
			instance.failed_attempts++;
		}

		if (instance.failed_attempts >= MAXIMUM_FAILED_ATTEMPTS) {
			mIsRunning = false;
			return; // stop.
		}

		if (mIsRunning) {
			if (mTimeout != null) {
				clearTimeout(mTimeout);
			}

			mTimeout = setTimeout(function() {
				request(onRequestCompleted)
			}, mMinimumInterval);
		}
	}

	return instance;
};