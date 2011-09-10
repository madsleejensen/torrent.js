var Events = require("events");
var Crypto = require("crypto");

module.exports = function piece (index, hash, length, callback) {
	
	var instance = new Events.EventEmitter();
		instance.loaded = false;
		instance.index = index;
		instance.length = length;
		instance.blocks = [];
		instance.completed = false;
		instance.hash = hash;
		instance.chunkSize = Math.pow(2, 10);
	
	instance.addBlock = function (offset, block) {
		if (instance.completed) {
			return;
		}
		var chunk = Math.floor(offset / instance.chunkSize);
		instance.blocks[chunk] = block;
		
		if (isComplete()) {
			if (!isValid()) {
				instance.blocks = []; // reset because of corrupted data.
			}
			else {
				instance.completed = true;
				instance.emit("piece_completed");
			}
		}
	};

	instance.getBlockOffsets = function (limit) {
		var missingChunks = [];
		var chunks = Math.ceil(instance.length / instance.chunkSize);
		for (var chunk = 0; chunk < chunks; chunk++) {
			if (instance.blocks[chunk] == null) {
				var begin = chunk * instance.chunkSize;
				var length = instance.chunkSize;

				if ((begin + length) > instance.length) {
					length = instance.length - begin;
				}

				missingChunks.push({
					begin: begin,
					length: length
				});
			}
		}

		return missingChunks;
	}; 

	instance.getValue = function () {
		if (instance.completed) {
			return instance.blocks.join("");
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

	callback();

	return instance;
};