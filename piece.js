var Events = require("events");
var Crypto = require("crypto");
var TaskQueue = require('./taskqueue');
var BlockManager = require('./managers/block_manager');
var Step = require('step');

exports.create = function Piece (index, hash, length, callback) {
	
	var instance = new Events.EventEmitter();
	instance.loaded = false;
	instance.index = index;
	instance.length = length;
	instance.blocks = null;
	instance.completed = false;
	instance.hash = hash;

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
	};

	instance.getValue = function (callback) {
		/*if (instance.completed) {
			mStorage.readPiece (instance, callback);
		}
		else {*/
			var buffer = new Buffer(instance.length);
			var total = 0;
			for (var i = 0; i < instance.blocks.blocks.length; i++) {
				var block = instance.blocks.blocks[i];
				block.data.copy(buffer, block.begin);	
				total += block.data.length;
			}

			//console.log('piece: [length: %d] [actual-lenght: %d]', instance.length, total);
			callback(null, buffer);
		//}
	}

	function onBlockCompleted (block) {
		if (instance.completed) {
			return;
		}

		console.log('block [index: %d][chunk: %d] completed', block.piece.index, block.chunk);

		if (instance.blocks.isAllCompleted()) {
			instance.completed = true; // mark as completed while validating to download as much as possible.
			console.log('piece: [index: %d] completed', instance.index);

			isValid(function (error, valid) {
				console.log('piece-validation: [index: %d] [valid: %d]', instance.index, valid);

				if (!valid) { // curropted data reset piece.
					instance.blocks.reset();
					instance.completed = false;
				}
				else {
					instance.completed = true;
					instance.emit("piece:completed", instance);
				}
			});
		}
	};

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
	
	Step (
		function createBlocks () {
			var callback = this;
			BlockManager.create(instance, function (error, manager) {
				instance.blocks = manager;
				manager.on('block:completed', onBlockCompleted);
				callback (error);
			});
		},
		function ready (error) {
			callback (error, instance);
		}
	);

	return instance;
};