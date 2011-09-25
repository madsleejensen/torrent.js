var U = require('U');
var Step = require('step');
var Block = require('./../block');
var Events = require ('events');
/**
 * Create's an maintain a list of blocks for a given Piece.
 * @see piece.js
 */
exports.create = function (torrent, piece, callback) {
	var instance = new Events.EventEmitter();
	instance.chunkSize = Math.pow(2, 14); // this is the maximum size supported by most torrent clients.
	instance.blocks = [];

	/**
	 * Returns the blocks that fall under a given offset specification. This is used by the
	 * DownloadItem to only download the blocks required for a given file.
	 * @see download_item.js
	 */
	instance.getByRange = function (offset) {
		var blockStart = 0;
		var blockEnd = (instance.blocks.length - 1);

		if (offset) {
			if (offset.start) {
				blockStart = Math.floor(offset.start / instance.chunkSize);
			}

			if (offset.end) {
				blockEnd = Math.floor(offset.end / instance.chunkSize);
			}
		}

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

			var block = new Block ({
				piece: piece,
				chunk: chunk,
				begin: begin,
				length: length,
				peers: []
			});

			instance.blocks[chunk] = block;
			block.once('block:completed', onBlockCompleted);

			// remove overflow that is caused because the (piece count * piece-length) is not equal to the actual size of the torrent file.
			// this will trim away overflowing blocks, and resize the 'block.length' attribute of the last block, in the last piece to match excatly the total filesize.
			var end = (begin + length);
			var totalFileOffset = end + (piece.index * piece.length); 

			if (totalFileOffset > torrent.fileManager.getTotalFileSize()) {
				var delta = totalFileOffset - torrent.fileManager.getTotalFileSize(); 
				block.length -= delta;
				//console.log(delta, chunk, totalOffset, torrent.fileManager.getFileSize(),'DELTA');
				break;
			}
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