var FileSystem = require('fs');
var Step = require('step');
var Bencoder = require('bencoder');
var Crypto = require('crypto');
var PieceManager = require('./managers/piece_manager');
var PeerManager = require('./managers/peer_manager');
var TrackerManager = require('./managers/tracker_manager');
var FileManager = require('./managers/file_manager');
var Storage = require('./storage');
var TaskQueue = require('./taskqueue');
var U = require('U');
var Downloader = require('./downloader');

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
	instance.downloader = null;

	instance.download = function (file) {
		console.log('downloading: [file: %s] [size: %s]', file.path, file.length);
		instance.trackerManager.start();
		instance.downloader.download(file);

		var stream = FileSystem.createWriteStream('downloads/' + file.path, {flags: 'w+', mode: 0777});
		var taskqueue = instance.downloader.createStream(stream);
		taskqueue.on('end', function () {
			console.log('file completed: [name: %s]', file.path);
		});
		taskqueue.run();

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
		instance.pieceManager.pieces.forEach(function(piece) {
			task.queue(function (callback) {
				var pieceStream = piece.createStream(destinationStream);
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
			var peerId = U.generateId(20);
			infomation.peer_id = peerId;
			infomation.peer_id_buffer = new Buffer(peerId);
			instance.infomation = infomation;

			console.log('\ntorrent: [file: %s] [name: %s]', filepath, instance.infomation.info.name);

			this();
		},
		function buildFilemanager (error) {
			if (error) throw error;
			instance.fileManager = FileManager.create(instance);
			this();
		},
		function initStorage (error) {
			if (error) throw error;
			instance.storage = new Storage(instance, this);
		},
		function initDownloader (error) {
			if (error) throw error;
			var callback = this;
			Downloader.create(instance, function (error, downloader) {
				instance.downloader = downloader;
				callback(error);
			});
		},
		function initPieceManager (error) {
			if (error) throw error;
			var callback = this;
			PieceManager.create(instance, function(error, manager) {
				instance.pieceManager = manager;
				callback (error);
			});
		},
		function initFileManager (error) {
			if (error) throw error;
			var callback = this;
			instance.fileManager.initialize(function (error, manager) {
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