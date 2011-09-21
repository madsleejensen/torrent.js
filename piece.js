var Events = require("events");
var Crypto = require("crypto");
var TaskQueue = require('./taskqueue');
var Block = require('./block');

exports.create = function Piece (index, hash, length) {
	
	var instance = new Events.EventEmitter();
	instance.loaded = false;
	instance.index = index;
	instance.length = length;
	instance.blocks = [];
	instance.completed = false;
	instance.hash = hash;
	instance.chunkSize = Math.pow(2, 14);
	
	instance.getMissingBlocks = function () {
		var result = [];

		instance.blocks.forEach(function(block) {
			if (!block.completed && !block.isFull()) {
				result.push(block);
			}
		});

		return result;
	};

	instance.createStream = function (destination) {
		var task = new TaskQueue();

		if (instance.completed) {
			task.queue (function (callback) {
				instance.getValue(function(error, data) {
					destination.write(data);
					callback();
				});
			});
		}
		else {	
			instance.blocks.forEach(function(block) {
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
	};

	instance.getValue = function (callback) {
		/*if (instance.completed) {
			mStorage.readPiece (instance, callback);
		}
		else {*/
			var buffer = new Buffer(instance.length);
			var total = 0;
			for (var i = 0; i < instance.blocks.length; i++) {
				var block = instance.blocks[i];
				block.data.copy(buffer, block.begin);	
				total += block.data.length;
			}

			//console.log('piece: [length: %d] [actual-lenght: %d]', instance.length, total);
			callback(null, buffer);
		//}
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
			
			var block = new Block ({
				piece: instance,
				chunk: chunk,
				begin: begin,
				length: length,
				peers: []
			});

			block.once('block:completed', onBlockCompleted);
			blocks[chunk] = block;
		}

		return blocks;
	};

	function onBlockCompleted (block) {
		if (instance.completed) {
			return;
		}

		//console.log('block [index: %d][chunk: %d] completed',block.piece.index, block.chunk);

		if (isComplete()) {
			instance.completed = true; // mark as completed while validating to download as much as possible.
			console.log('piece: [index: %d] completed', instance.index);

			isValid(function (error, valid) {
				console.log('piece-validation: [index: %d] [valid: %d]', instance.index, valid);

				if (!valid) { // curropted data reset piece.
					instance.blocks.forEach(function(block) { 
						block.reset();
						instance.completed = false;
					});
				}
				else {
					instance.completed = true;
					instance.emit("piece:completed");
				}
			});
		}
	};

	function isComplete () {
		// reverse lookup for performance.
		for (var i = (instance.blocks.length - 1); i >= 0; i--) {
			if (!instance.blocks[i].completed) {
				//console.log('block [index: %d][chunk: %d][peers: %d] notcompleted',instance.blocks[i].piece.index, instance.blocks[i].chunk,instance.blocks[i].peers.length);
				return false;
			}
		}

		return true;
	}

	function isValid (callback) {
		instance.getValue(function (error, buffer) {
			var sha1 = Crypto.createHash('sha1');
			sha1.update(buffer.toString('binary'));

			var hash = sha1.digest('binary');

			//console.log("isvalid: %s vs %s", hash, instance.hash);

			var valid = (hash == instance.hash);

			callback (null, valid)
		});
		
	}

	instance.blocks = createBlockOffsets();

	return instance;
};