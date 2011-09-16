var Events = require("events");
var Crypto = require("crypto");
var Block = require('block');

module.exports = function Piece (index, hash, length) {
	
	var instance = new Events.EventEmitter();
	instance.loaded = false;
	instance.index = index;
	instance.length = length;
	instance.blocks = [];
	instance.completed = false;
	instance.hash = hash;
	instance.chunkSize = Math.pow(2, 10);
	
	instance.addBlock = function (offset, data) {
		

		if (instance.completed) {
			return;
		}

		var chunk = Math.floor(offset / instance.chunkSize);
		instance.blocks[chunk].setValue(data);
		
		if (isComplete()) {
			if (!isValid()) {
				instance.blocks = []; // reset because of corrupted data.
			}
			else {
				instance.completed = true;
				instance.emit("piece:completed");
			}
		}
	};

	instance.getMissingBlocks = function () {
		var result = [];

		instance.blocks.forEach(function(block) {
			if (!block.completed) {
				result.push(offset);
			}
		});

		return result;
	};

	instance.createStream = function (destination) {
		var task = new TaskQueue();

		if (instance.completed) {
			task.queue (function (callback) {
				piece.getValue(function(data) {
					destination.write(data);
					callback();
				});
			});
		}
		else {	
			instance.blocks.forEach(function(block) {
				task.queue(function (callback) {
					// getvalue should delay callback till block data is received.
					if (block.getValue(function (data) { 
						destination.write(data);
						callback();
					}));
				});
			});	
		}

		return task;
	};

	instance.getValue = function (callback) {
		if (instance.completed) {
			mStorage.readPiece (instance, callback);
		}
		else {
			for (var i = 0; i < instance.blocks.length; i++) {
				if (typeof instance.blocks[i] == 'undefined') {
					break;
				}

				getBlock(i, function (error, chunk, data) {
					
				});
			}
		}
	}

	function isComplete () {
		var chunks = Math.ceil(instance.length / instance.chunkSize);
		if (instance.blocks.length < chunks) {
			return false;
		}

		for (var index in instance.blocks) {
			if (!instance.blocks[index]) {
				return false;
			}
		}

		return true;
	}

	function isValid () {
		var value = instance.getValue();
		var sha1 = crypto.createHash('sha1');
		sha1.update(value);

		var hash = sha1.digest('binary');

		return hash === instance.hash;
	}

	function createBlockOffsets () {
		var offsets = [];
		var chunks = Math.ceil(instance.length / instance.chunkSize);
		var blocks = [];
		for (var chunk = 0; chunk < chunks; chunk++) {
			var begin = chunk * instance.chunkSize;
			var length = instance.chunkSize;

			if ((begin + length) > instance.length) {
				length = instance.length - begin;
			}
			
			blocks[chunk] = new Block ({
				piece: instance,
				chunk: chunk,
				begin: begin,
				length: length,
				peers: []
			});
		}

		return blocks;
	}; 

	instance.blocks = createBlockOffsets();

	return instance;
};