var Events = require('events');
var TaskQueue = require('./taskqueue');
/**
 * Each @file is made up of a set of @download_items to be completed, in order for the file to be fully downloaded.
 * @download_items keeps track on missing blocks of the @piece they represent, and they are responsible for clipping the block's data appropriately.
 */
module.exports = function (requirement) {
	var instance = new Events.EventEmitter();
	instance.blocks = null;
	instance.offset = requirement.offset;
	instance.piece = requirement.piece;
	instance.completed = false;

	instance.createStreamQueue = function (destination) {
		var task = new TaskQueue();

		if (!instance.blocks) {
			task.queue (function (callback) {
				var pieceQueue = instance.piece.createStreamQueue(destination);
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
							var length = data.length - remove;
							data = data.slice(0, length);
						}

						if (!data) {
							return;
						}

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