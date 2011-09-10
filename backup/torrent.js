var FileSystem = require("fs");
var Bencoder = require("./bencoder");
var Crypto = require("crypto");
var Emitter = require("events").Emitter;
var HttpTracker = require("./http-tracker");

exports.create = function (filename, server) {
	var peers = [];
	var instance = Emitter();
		instance.peerId = server.createPeerId();

	var tracker = HttpTracker.create();

	parse(filename, function(error, torrent) {
		instance.torrent = torrent;
		instance.emit('ready');

		tracker.on('peers_received', function(peers) {
				
		});

		tracker.request(torrent);
	});

	return instance;
};

function parse (filename, callback) {
	FileSystem.readFile(filename, 'binary', function(error, data) {
		if (error) callback(error);

		var torrent = Bencoder.decode(data);
			torrent.info_hash = createInfoHash(torrent);

		callback(null, torrent);
	});
};

function createInfoHash (torrent) {
	var encodedInfoValue = Bencoder.encode(infomation.info);

	var shasum = Crypto.createHash('sha1');
		shasum.update(encodedInfoValue);

	return shasum.digest('hex');
};