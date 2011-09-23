var U = require('U');
var Step = require('step');
var Block = require('./../block');
var Events = require ('events');

exports.create = function (piece, callback) {
	
	var instance = new Events.EventEmitter();
	instance.chunkSize = Math.pow(2, 14);
	instance.blocks = [];

	instance.getByRange = function (offset) {
		var blockStart = Math.floor(offset.start / instance.chunkSize);
		var blockEnd = Math.floor(offset.end / instance.chunkSize);

		var result = [];

		for (var chunk = blockStart; chunk <= blockEnd; chunk++) {
			result.push(instance.blocks[chunk]);
		}

		return result;
	};

	instance.getMissing = function (range) {
		var result = [];

		instance.blocks.forEach(function(block) {
			if (block.completed) {
				return;
			}
			if (block.isFull()) {
				return;
			}
			if (range) { // optional if range defined only return missing blocks within that range.
				if (block.chunk < range.start || block.chunk > range.end) {
					return;
				}	
			}

			result.push(block);
		});

		return result;
	};

	instance.isAllCompleted = function () {
		for (var i = (instance.blocks.length - 1); i >= 0; i--) {
			if (!instance.blocks[i].completed) {
				//console.log('block [index: %d][chunk: %d][peers: %d] notcompleted',instance.blocks[i].piece.index, instance.blocks[i].chunk,instance.blocks[i].peers.length);
				return false;
			}
		}

		return true;
	};

	function createBlocks (callback) {
		var offsets = [];
		var chunks = Math.ceil(piece.length / instance.chunkSize);
		var blocks = [];

		for (var chunk = 0; chunk < chunks; chunk++) {
			var begin = chunk * instance.chunkSize;
			var length = instance.chunkSize;

			if ((begin + length) > piece.length) {
				length = piece.length - begin;
			}
			
			var block = new Block ({
				piece: piece,
				chunk: chunk,
				begin: begin,
				length: length,
				peers: []
			});

			instance.blocks[chunk] = block;
			block.once('block:completed', onBlockCompleted);
		}

		callback (null);
	}

	function onBlockCompleted (block) {
		// notify that a block has been completed 'block[x]:completed'
		var eventName = 'block[' + block.chunk + ']:completed';
		instance.emit(eventName, block);
		instance.emit('block:completed', block);
	}

	Step (
		function create () {
			createBlocks (this);
		},
		function ready (error) {
			callback (error, instance);
		}
	);
};