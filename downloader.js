var Events = require('events');
var Config = require('./config');
var U = require('U');

/**
 * Responsible for taking a @file instance and allowing peers to request blocks within that file's range to be downloaded.
 * This class could be modified to return blocks in the "rarest" first order instead of sequential.
 */

exports.create = function Downloader (torrent, file) {
	var instance = new Events.EventEmitter();
	instance.file = file;
	instance.isDownloading = false;

	// list of blocks that are currently being requested by this downloader.
	instance.activeBlocks = [];

	function onFileCompleted () {
		console.log('downloader: [file: %s] completed', instance.file.path);
		instance.isDownloading = false;
	}

	// queue up block requests on a peer.
	instance.addPeerBlockRequests = function (peer) {
		if (!file.isActive()) {
			return;
		}

		var slots = peer.getRequestSlotsAvailable();
		if (slots <= 0) {
			return;
		}

		var blocks = instance.getNextBlocks(peer, slots);
		blocks.forEach(function (block) {
			var succes = peer.download(block, instance);
			if (succes) {
				if (instance.activeBlocks.indexOf(block) === -1) {
					instance.activeBlocks.push(block);
					block.once('block:completed', function () {
						U.array.remove(instance.activeBlocks, block);
					});
				}
						
				block.peers.push(peer);
			}
		});
	}

	/**
	 * This is the logic used to determine the order in which blocks should be downloaded.
	 */
	instance.getNextBlocks = function (peer, limit) {
		if (instance.file === null) {
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

				if (block.peers.indexOf(peer) !== -1) {
					continue; // peer is already requesting this block.
				}

				result.push(block);
				limit--;
			}
		}

		/**
		1) attempt to fill peer within the download range.	
			1)
		2) fill peer with anything that is required by the file download.
		3) dont fill peer.
		*/
		return result;
	};

	// find the next piece to download that is available for the peer.
	instance.getNextAvailableItem = function (peer, exclude) {
		var available = peer.getAvailablePieces();	
		if (available.length < 1) {
			return;
		}

		for (var i = 0; i < instance.file.downloadItems.length; i++) {
			var item = instance.file.downloadItems[i];
			
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

	file.once('file:completed', onFileCompleted);
	torrent.once('peer_manager:ready', function () {
		torrent.peerManager.on('active_peers_count:changed', adjustBlocksPeerLimit);	
	});

	return instance;
};