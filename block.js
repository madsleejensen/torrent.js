var Events = require('events');

module.exports = function Block (params) {

	var instance = new Events.EventEmitter();
	instance.piece = null;
	instance.chunk = null;
	instance.begin = null;
	instance.length = null;
	instance.data = null;
	instance.storage = 'memory';
	instance.completed = false;
	instance.peers = [];

	instance.getValue = function (callback) {
		if (!instance.completed) { // block has not yet been downloaded, listen for completed event.
			instance.on('block:completed', function () {
				callback (null, instance.data);
			});
		}
		else { // block has been downloaded.
			if (instance.storage == 'memory') {
				callback (null, instance.data);
			}
			else if (block.storage == 'file') {
				mStorage.readPieceBlock (instance, chunk, callback);
			}	
		}
	};

	// set the block's value, this will notify all listeners that the block has been downloaded.
	instance.setValue = function (data) {
		if (instance.completed) {
			return;
		}

		instance.data = data;
		instance.completed = true;
		instance.emit('block:completed');
		instance.removeAllListeners(); // cleanup.
	}

	for (var member in params) { // initialize
		instance[member] = params[member];		
	}

	return instance;
};