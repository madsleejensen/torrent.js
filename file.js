var TaskQueue = require ('./taskqueue');

module.exports = function (path, length, pieceIndexes) {
	var instance = {};
	instance.path = path;
	instance.length = length;
	instance.pieces = pieceIndexes;

	// create a datastream, to start streaming the content of the torrent.
	instance.createStream = function (destinationStream) {
		var task = new TaskQueue();
		
		// queue up piece tasks.
		instance.pieces.forEach(function(piece) {
			task.queue(function (callback) {
				var pieceStream = piece.createStream(destinationStream);
				pieceStream.on('end', callback); 
				pieceStream.run();
			});
		});

		return task;
	};

	
	return instance;
};