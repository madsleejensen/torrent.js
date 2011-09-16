var FileSystem = require('fs');
var Step = require('step');
var Bencoder = require('./bencoder');
var Crypto = require('crypto');
var PieceManager = require('./piece_manager');
var PeerManager = require('./peer_manager');
var TrackerManager = require('./tracker_manager');
var Storage = require('./storage');
var TaskQueue = require('./taskqueue');

/**
 * Represents a *.torrent to be downloaded.
 */
exports.create = function Torrent (filepath, callback) {
	var instance = {};
	instance.infomation = null; // decoded infomation from the *.torrent file.
	instance.storage = null;
	instance.pieceManager = null;
	instance.peerManager = null;
	instance.trackerManager = null;

	instance.download = function () {
		console.log('downloading: %s : %s', filepath, instance.infomation.info.name);
		instance.trackerManager.start();

		// make sure all active peers always working on something.
		setInterval(function() {
			if (instance.peerManager.getActive().length < 1) {
				return;		
			}

			instance.peerManager.getActive().forEach(function(peer) {
				peer.download();
			});
		}, 500);
	};

	// create a datastream, to start streaming the content of the torrent.
	instance.createStream = function (destinationStream) {
		var task = new TaskQueue();
		
		// queue up piece tasks.
		mPieces.forEach(function(piece) {
			task.queue(function (callback) {
				var pieceStream = piece.createPieceStream(destinationStream);
				pieceStream.on('end', callback); 
				pieceStream.run();
			});
		});

		return task;
	};

	Step ( // initialize
		function decodeFile () {
			decodeTorrentFile(filepath, this);
		},
		function fileDecoded (error, infomation) {
			if (error) throw error;
			
			infomation.peer_id = 'qwertyuiopasdfghjxla';
			instance.infomation = infomation;
			this();
		},
		function initStorage (error) {
			if (error) throw error;
			instance.storage = new Storage(instance, this);
		},
		function initPieceManager (error) {
			if (error) throw error;
			var callback = this;
			PieceManager.create(instance, function(error, manager) {
				instance.pieceManager = manager;
				callback (error);
			});
		},
		function initTrackerManager (error) {
			if (error) throw error;
			var callback = this;
			TrackerManager.create(instance, function(error, manager) {
				instance.trackerManager = manager;
				callback (error);
			});
		},
		function initPeerManager (error) {
			if (error) throw error;
			var callback = this;

			PeerManager.create(instance, function(error, manager) {
				instance.peerManager = manager;
				callback (error);
			});
		},
		function complete (error) {
			callback(error, instance);
		}
	);
};

function decodeTorrentFile (filepath, callback) {
	FileSystem.readFile(filepath, 'binary', function(error, data) {
		if (error) callback(error);

		var torrent = Bencoder.decode(data);
			torrent.info_hash = createInfoHash(torrent);

		callback(null, torrent);
	});
}

function createInfoHash (torrent) {
	var encodedInfoValue = Bencoder.encode(torrent.info);

	var shasum = Crypto.createHash('sha1');
		shasum.update(encodedInfoValue);

	return shasum.digest('hex');
};