var Events = require('events');
var Config = require('./config');

/**
 * Responsible for taking a @file instance and allowing peers to request blocks within that file's range to be downloaded.
 * This class could be modified to return blocks in the "rarest" first order instead of sequential.
 */

exports.create = function Downloader (torrent, callback) {
	var instance = new Events.EventEmitter();
	instance.currentFile = null;
	instance.isDownloading = false;
	var mInterval = null;

	instance.download = function (file) {
		torrent.trackerManager.start();

		instance.currentFile = file;
		instance.currentFile.on('file:completed', onFileCompleted);

		if (mInterval != null) {
			clearInterval(mInterval);
			mInterval = null;
		}

		// make sure all active peers always working on something.
		mInterval = setInterval(function() {
			if (torrent.peerManager.getActive().length < 1) {
				return;		
			}

			torrent.peerManager.getActive().forEach(function(peer) {
				instance.addPeerBlockRequests (peer);
			});
		}, 500);

		instance.isDownloading = true;
	};

	function onFileCompleted () {
		console.log('downloader: [file: %s] completed', instance.currentFile.path);
		instance.isDownloading = false;
		torrent.trackerManager.stop();
		clearInterval(mInterval);
		mInterval = null;
	}

	// queue up block requests on a peer.
	instance.addPeerBlockRequests = function (peer) {
		var slots = peer.getRequestSlotsAvailable();
		if (slots <= 0) {
			return;
		}

		var blocks = instance.getNextBlocks(peer, slots);
		blocks.forEach(function (block) {
			block.peers.push(peer);
			peer.download(block);
		});
	}

	instance.getNextBlocks = function (peer, limit) {
		if (instance.currentFile === null) {
			throw new Error('Downloader: no file selected for download.');
		}

		var exclude = []; // list of items to ignore in next call to getNextAvailableItem();
		var result = [];

		while (limit > 0) {
			var item = instance.getNextAvailableItem(peer, exclude);
			if (!item) {
				break;
			}

			exclude.push(item); // make sure we wont encounter the same item again in this iteration.

			var blocks = item.getFreeBlocks();
			if (blocks.length <= 0) {
				continue;
			}

			for (var index = 0; index < blocks.length && limit > 0; index++) {
				var block = blocks[index];
				result.push(block);
				limit--;
			}
		}

		return result;
	};

	// find the next piece to download that is available for the peer.
	instance.getNextAvailableItem = function (peer, exclude) {
		var available = peer.getAvailablePieces();	
		if (available.length < 1) {
			return;
		}

		for (var i = 0; i < instance.currentFile.downloadItems.length; i++) {
			var item = instance.currentFile.downloadItems[i];
			
			if (item.completed) {
				continue;
			}
			if (exclude.indexOf(item) !== -1) {
				continue;
			}
			if (available.indexOf(item.piece.index) === -1) {
				continue; // peer does not have the piece available.
			}
			
			return item;
		}
	};

	function adjustBlocksPeerLimit () {

	};

	torrent.once('peer_manager:ready', function () {
		torrent.peerManager.on('active_peers_count:changed', adjustBlocksPeerLimit);	
	});

	callback(null, instance);
};