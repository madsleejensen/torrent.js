function createDataStream(destination) { // torrent.
	var datastream = new DataStream();
	
	torrent.pieces.forEach(function(piece) {
		datastream.queue(function (callback) {
			var pieceStream = piece.createPieceStream(destination, piece);
			pieceStream.on('end', callback); // datastream is responsible for emitting the end event.
			pieceStream.run();
		});
	});

	return datastream;
};

function createPieceStream (destination, piece) {
	var datastream = new DataStream();

	if (piece.completed) {
		datastream.queue (function (callback) {
			piece.getValue(function(data) {
				destination.write(data);
				callback();
			});
		});
	}
	else {	
		piece.blocks.forEach(function(block) {
			datastream.queue(function (callback) {
				if (block.getValue(function (data) { // getvalue should delay callback till block data is received. // getvalue sætter en listener så når ny data kommer ind bliver alle streams notified.
					destination.write(data);
					callback();
				}));
			});
		});	
	}

	return datastream;
};

var datastream = torrent.createDataStream(socket);
datastream.run();