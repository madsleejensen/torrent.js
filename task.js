var Events = require('events');

exports.Task = function () {
	instance.run = function (destination, callback) {
		callback (null);
	};
	return instance;	
};

exports.WriteBlock = function (piece, block) {
	var instance = new exports.Task();
	
	instance.run = function (destination, callback) {
		if (block.storage == 'memory') {
			destination.write (data); 
			callback ();
		}
		else {
			Step (
				function readFile () {
					piece.getBlockData (block.chunk, this);
				},
				function write (error, data) {
					if (error) {
						throw error;
					}
					destination.write (data); 
					callback (error);		
				}
			);
		}
	};

	return instance;
};

exports.WritePiece = function (piece) {
	var instance = new exports.Task();
	
	instance.run = function (destination, callback) {
		if (piece.completed) {
			Step (
				function readFile () {
					piece.storage.getPieceFileStream (piece, this);
				},
				function write (error, stream) {
					if (error) {
						throw error;
					}

					stream.pipe(destination);
					stream.on('end', function () {
						callback();
					});
				}
			);
		}
		else {
			for (var i = 0; i < instance.blocks.length; i++) {
				var block = instance.blocks[i];
				
				var task = new WriteBlock(piece, block);

				piece.on('completed', function() {
					callback();	
				});

			}
		}
	};

	return instance;
};

exports.WritePieces = function () {
		

};




var torrent;
var stream = torrent.createStream(destination);


var datastream = new DataStream(destination);
	datastream.queue(function() {
		for (var )
	});


