var Events = require('events');
/**
 * Responsible for taking a @file instance and allowing peers to request blocks within that file's range to be downloaded.
 * This class could be modified to return blocks in the "rarest" first order instead of sequential.
 */
exports.create = function Downloader (torrent, callback) {
	var instance = new Events.EventEmitter();
	instance.currentFile = null;

	instance.download = function (file) {
		instance.currentFile = file;
	};

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

	callback(null, instance);
};