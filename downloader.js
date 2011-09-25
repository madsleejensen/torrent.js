var Events = require('events');
var TaskQueue = require('./taskqueue');
var DownloadItem = require('./download_item');
/**
 * Responsible for taking a @file instance and allowing peers to request blocks within that file's range to be downloaded.
 * This class could be modified to return blocks in the "rarest" first order instead of sequential.
 */
exports.create = function Downloader (torrent, callback) {
	var instance = new Events.EventEmitter();
	instance.items = [];

	instance.download = function (file) {
		instance.items = [];

		for (var i = 0; i < file.requirements.length; i++) {
			var requirement = file.requirements[i];
			var item = new DownloadItem (requirement);
			instance.items.push(item);
		}
	};

	instance.createStream = function (destination) {
		var task = new TaskQueue();

		instance.items.forEach(function(item) {
			task.queue (function (callback) {
				var itemTask = item.createStream(destination);	
				itemTask.on('end', function () {
					callback ();
				});
				itemTask.run();
			});
		});
		
		return task;
	};

	instance.getNextBlocks = function (peer, limit) {
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

		for (var i = 0; i < instance.items.length; i++) {
			var item = instance.items[i];
			
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