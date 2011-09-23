var Events = require('events');
var TaskQueue = require('./taskqueue');

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


var DownloadItem = function (requirement) {
	var instance = new Events.EventEmitter();
	instance.blocks = null;
	instance.offset = requirement.offset;
	instance.piece = requirement.piece;
	instance.completed = false;
	
	console.log(instance.offset);

	instance.createStream = function (destination) {
		var task = new TaskQueue();

		if (!instance.blocks) {
			task.queue (function (callback) {
				var pieceQueue = instance.piece.createStream(destination);
				pieceQueue.on('end', function () {
					callback();
				});
				pieceQueue.run();
			});
		}
		else {	
			instance.blocks.forEach(function(block) {
				task.queue(function (callback) {
					if (block.getValue(function (error, data) {
						// block's data overflow what is requested, trim it to match.
						if (instance.offset.start !== null && block.isWithinOffset(instance.offset.start)) {
							var skip = instance.offset.start - block.begin;
							data = data.slice(skip);
						}

						if (instance.offset.end !== null && block.isWithinOffset(instance.offset.end)) {
							var remove = (block.begin + block.length) - instance.offset.end; // bytes to remove from the current block's length.

							//console.log('REMOVE', remove, data.length);

							var length = data.length - remove;
							data = data.slice(0, length);
						}
						/*
						console.log("------");
						console.log(instance.offset, instance.offset.start - instance.offset.end);
						console.log(block.begin, instance.offset.start - block.begin);
						console.log(block.begin, block.length, block.begin + block.length, instance.offset.end - (block.begin + block.length));
						*/
						destination.write(data);
						callback();
					}));
				});
			});
		}

		return task;
	};

	instance.getFreeBlocks = function () {
		var result = [];

		if (instance.blocks === null) { // no specific blocks, means that the entire piece is required.
			return instance.piece.blocks.getMissing();
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
			//console.log('download_item completed.');
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