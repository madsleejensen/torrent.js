var Events = require("events");
var Crypto = require("crypto");
var TaskQueue = require('./taskqueue');
var BlockManager = require('./managers/block_manager');
var Step = require('step');

exports.create = function Piece (torrent, index, hash, length, callback) {
	
	var instance = new Events.EventEmitter();
	instance.loaded = false;
	instance.index = index;
	instance.length = length;
	instance.blocks = null;
	instance.completed = false;
	instance.hash = hash;
	instance.storage = 'memory';

	instance.createStreamQueue = function (destination) {
		var task = new TaskQueue();

		if (instance.storage === 'file') {
			task.queue (function (callback) {
				torrent.storageManager.getPieceStream(instance, function(error, stream) {
					if (error) {
						console.log(error.message, error.stack);
						return;
					}

					stream.on('end', function () {
						//stream.destroy();
						callback();
					});

					stream.pipe(destination, {end: false});
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

	instance.combineBlockValues = function (callback) {
		if (!instance.completed) {
			throw new Error('piece.getValue() called in incomplete piece. [index: %d]', piece.index);
		}

		var buffer = new Buffer(instance.length);
		var total = 0;
		for (var i = 0; i < instance.blocks.blocks.length; i++) {
			var block = instance.blocks.blocks[i];
			block.data.copy(buffer, block.begin);	
			total += block.data.length;
		}

		callback(null, buffer);
	}

	function onBlockCompleted (block) {
		if (instance.completed) {
			return;
		}

		// console.log('block [index: %d][chunk: %d] completed', block.piece.index, block.chunk);
		if (instance.blocks.isAllCompleted()) {
			instance.completed = true; // mark as completed while validating to download as much as possible.
			//console.log('piece: [index: %d] completed', instance.index);

			isValid(function (error, valid) {
				//console.log('piece-validation: [index: %d] [valid: %d]', instance.index, valid);

				if (!valid) { // curropted data reset piece.
					instance.blocks.reset();
					instance.completed = false;
					console.log('PIECE INVALID !!!!! ', instance.index, valid);
				}
				else {
					instance.completed = true;
					instance.emit("piece:completed", instance);

					// persist file away from memory.
					torrent.storageManager.savePiece(instance, function (error) {
						instance.storage = 'file';
						instance.blocks.reset();
						instance.blocks = null;
					});;
				}
			});
		}
	};

	function isValid (callback) {
		instance.combineBlockValues(function (error, buffer) {
			var sha1 = Crypto.createHash('sha1');
			sha1.update(buffer.toString('binary'));

			var hash = sha1.digest('binary');
			var valid = (hash == instance.hash);

			callback (null, valid);
		});
	}
	
	Step (
		function createBlocks () {
			var callback = this;
			BlockManager.create(torrent, instance, function (error, manager) {
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