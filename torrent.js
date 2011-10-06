var FileSystem = require('fs');
var Step = require('step');
var Bencoder = require('bencoder');
var Crypto = require('crypto');
var PieceManager = require('./managers/piece_manager');
var PeerManager = require('./managers/peer_manager');
var TrackerManager = require('./managers/tracker_manager');
var FileManager = require('./managers/file_manager');
var StorageManager = require('./managers/storage_manager');
var TaskQueue = require('./taskqueue');
var U = require('U');
var Downloader = require('./downloader');
var Events = require('events');

/**
 * Represents a *.torrent to be downloaded.
 */
exports.create = function Torrent (filepath, callback) {
	var instance = new Events.EventEmitter();
	instance.infomation = null; // decoded infomation from the *.torrent file.
	instance.storageManager = null;
	instance.pieceManager = null;
	instance.peerManager = null;
	instance.trackerManager = null;
	instance.fileManager = null;
	instance.isActive = true;

	instance.setActive = function (active) {
		instance.isActive = active;
		instance.emit('torrent:active_state_changed');
	};

	// create a datastream, to start streaming the content of the torrent.
	instance.createStream = function (destinationStream) {
		var task = new TaskQueue();
		// queue up piece tasks.
		instance.pieceManager.pieces.forEach(function(piece) {
			task.queue(function (callback) {
				var pieceStream = piece.createStream(destinationStream);
				pieceStream.on('end', callback); 
				pieceStream.run();
			});
		});
		return task;
	};

	function onActiveStateChanged () {
		if (instance.isActive) {
			instance.trackerManager.start();
		}
		else {
			instance.trackerManager.stop();
		}
	}

	Step ( // initialize
		function decodeFile () {
			decodeTorrentFile(filepath, this);
		},
		function fileDecoded (error, infomation) {
			if (error) throw error;
			var peerId = U.generateId(20);
			infomation.peer_id = peerId;
			infomation.peer_id_buffer = new Buffer(peerId);
			instance.infomation = infomation;
			instance.emit('torrent:decoded');

			console.log('\ntorrent: [file: %s] [name: %s]', filepath, instance.infomation.info.name);

			this();
		},
		function buildFilemanager (error) {
			if (error) throw error;
			instance.fileManager = FileManager.create(instance);
			this();
		},
		function initStorageManager (error) {
			if (error) throw error;
			var callback = this;
			StorageManager.create(instance, function (error, manager) {
				instance.storageManager = manager;
				callback (error);
			});
		},
		function initPieceManager (error) {
			if (error) throw error;
			var callback = this;
			PieceManager.create(instance, function(error, manager) {
				instance.pieceManager = manager;
				instance.emit('piece_manager:ready');
				callback (error);
			});
		},
		function initFileManager (error) {
			if (error) throw error;
			var callback = this;
			instance.fileManager.initialize(function (error, manager) {
				instance.emit('file_manager:ready');
				callback (error);
			});
		},
		function initTrackerManager (error) {
			if (error) throw error;
			var callback = this;
			TrackerManager.create(instance, function(error, manager) {
				instance.trackerManager = manager;
				instance.emit('tracker_manager:ready');
				callback (error);
			});
		},
		function initPeerManager (error) {
			if (error) throw error;
			var callback = this;

			PeerManager.create(instance, function(error, manager) {
				instance.peerManager = manager;
				instance.emit('peer_manager:ready');
				callback (error);
			});
		},
		function runLoop (error) {
			if (error) throw error;
			
			setInterval(function() {
				
				var files = U.array.find(instance.fileManager.files, function(file) { return file.isActive(); });
				instance.setActive(files.length > 0);

				if (instance.isActive) {
					var peers = instance.peerManager.getFreeActivePeers();

					/**
					 * Spread the peers out on the active files.
					 * peers are returned sorted by the lowest respondtime.
					 * therefore we spread the good peers out on the files.
					 */
					for (var i = 0; i < peers.length; i++) {
						// determine which file to assign to by modulus
						var fileIndex = (fileIndex === 0) ? 0 : i % files.length;
						var file = files[fileIndex];
						var peer = peers[i];
						file.downloader.addPeerBlockRequests(peer);
					}

					/* old implementation that surfed from, that the first file would always 
					   get the best number (chunkSize) peers with the lowest avarageRespondTime. because of the splitting of peers.
					
					var chunkSize = Math.ceil(peers.length / files.length);
					// split up all available active peers to do work on each active file.
					for (var i = 0; i < files.length; i++) {
						var file = files[i];
		 				var offset = chunkSize * i;
		 				var end = Math.min(offset + chunkSize, peers.length); // avoid overflow.

		 				// queue up block requests to file.
						for (var x = offset; x < end; x++) {
							var peer = peers[x];
							file.downloader.addPeerBlockRequests(peer);
						}
					}*/
				}

			}, 500);

			this();
		},
		function complete (error) {
			instance.on('torrent:active_state_changed', onActiveStateChanged);
			callback(error, instance);
		}
	);
};

function decodeTorrentFile (filepath, callback) {
	FileSystem.readFile(filepath, 'binary', function(error, data) {
		if (error) callback(error);

		var torrent = Bencoder.decode(data);
		var hash = createInfoHash(torrent);
		torrent.info_hash = hash;
		torrent.info_hash_buffer = new Buffer(hash, 'hex');
				
		callback(null, torrent);
	});
}

function createInfoHash (torrent) {
	var encodedInfoValue = Bencoder.encode(torrent.info);

	var shasum = Crypto.createHash('sha1');
		shasum.update(encodedInfoValue);

	return shasum.digest('hex');
};