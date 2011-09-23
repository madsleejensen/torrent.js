var Events = require('events');

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


var DownloadItem = function (requirement) {
	var instance = new Events.EventEmitter();
	instance.blocks = null;
	instance.offset = requirement.offset;
	instance.piece = requirement.piece;
	instance.completed = false;
	/*
	instance.createStream = function (destination, offset) {
		var task = new TaskQueue();

		if (instance.completed) {
			task.queue (function (callback) {
				instance.getValue(function(error, data) {
					if (offset) {
						data = data.slice(offset.start, offset.end);
					}

					destination.write(data);
					callback();
				});
			});
		}
		else {	
			instance.blocks.blocks.forEach(function(block) {
				task.queue(function (callback) {
					// getvalue should delay callback till block data is received.
					if (block.getValue(function (error, data) {
						destination.write(data);
						callback();
					}));
				});
			});
		}

		return task;
	};*/

	instance.getFreeBlocks = function () {
		var result = [];

		if (instance.blocks === null) { // no specific blocks, means that the entire piece is required.
			return piece.blocks.getMissing();
		}
		else {
			instance.blocks.forEach(function(block) {
				if (block.completed) {
					return;
				}
				if (block.isFull()) {
					return;
				}
				
				result.push(block);
			});
		}
		
		return result;
	};

	function onCompleted () {
		if (isCompleted()) {
			instance.completed = true;
			instance.emit('download_item:completed', instance);
			console.log('download_item completed.');
		}
	}

	function isCompleted () {
		if (instance.blocks) {
			for (var i = 0; i < instance.blocks.length; i++) {
				if (!instance.blocks[i].completed) {
					return false;
				}
			}

			return true;
		}
		else {
			return instance.piece.completed;
		}
	}

	if (requirement.offset) {
		instance.blocks = requirement.piece.blocks.getByRange(requirement.offset);
		instance.blocks.forEach(function (block) {
			block.once('block:completed', onCompleted);
		});
	}
	else {
		requirement.piece.on('piece:completed', onCompleted);
	}

	return instance;	
};



/*
download manager;

downloader.getNextBlock();


var downloadTask = {
	piece: {}
	completed: ...;
}

downloadTask.on('completed', function () {
	
});

downloader.queue({piece: piece}); // wait for piece to complete.
downloader.queue({piece: piece, offset: {start: 12, end: 28}}); // wait for blocks to complete.
*/