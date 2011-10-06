var FileSystem = require('fs');
var Path = require('path');
var Step = require('step');
var Config = require('./../config');

exports.create = function (torrent, callback) {
	
	var instance = {};
	instance.path = './storage/' + torrent.infomation.info_hash + '/';
	
	instance.pieceExists = function (piece, callback) {
		var filepath = Path.join(instance.path, piece.index.toString(), piece.index.toString() + '.data');
		Path.exists(filepath, callback);
	};

	instance.getPieceStream = function (piece, callback) {
		var filepath = Path.join(instance.path, piece.index.toString(), piece.index.toString() + '.data');
		instance.pieceExists(piece, function(exists) {
			if (!exists) {
				var error = new Error('storage: [piece: %d] does not have any persisted data.', piece.index);
				return callback (error);
			}

			var stream = FileSystem.createReadStream(filepath, {flags: 'r'});
			callback (null, stream);
		});
	};
	
	instance.savePiece = function (piece, callback) {	
		var directoryPath = Path.join(instance.path, piece.index.toString());
		var filepath = Path.join(directoryPath, piece.index.toString() + '.data');

		Step(
			function directory () {
				prepareDirectory (directoryPath, this);
			},
			function writeOut () {
				var outputStream = FileSystem.createWriteStream(filepath, {flags: 'w+', mode: 0777});
				var taskQueue = piece.createStreamQueue(outputStream);
				taskQueue.on('end', this);
				taskQueue.run();
			},
			function cleanup () {
				// remove block directory if exists.
				var blockDirectoryPath = Path.join(directoryPath, 'blocks');
				removeDirectory (blockDirectoryPath, function (error) {
					if (callback != null) {
						callback ();			
					}
				});
			}
		);
	};

	// ensures that the directory exists.
	function prepareDirectory (path, callback) {
		Path.exists(path, function(exists) {
			if (!exists) {
				FileSystem.mkdir(path, 0777, callback);
			}
			else {
				callback();
			}
		}); 
	}

	function removeDirectory (path, callback) {
		FileSystem.readdir(path, function (error, files) {
			if (error) {
				return callback (error);
			}

			Step (
				function removeFiles () {
					var group = this.group();
					files.forEach(function (file) {
						
						var filepath = Path.join(path, file);
						var callback = group();

						FileSystem.stat(filepath, function(error, stat) {
							if (stat.isDirectory()) {
								removeDirectory (filepath, callback);
							}
							else {
								FileSystem.unlink(filepath, callback);
							}
						});
					});
				},
				function removeDir () {
					FileSystem.rmdir(path, callback);
				}
			);
		});
	}

	Step (
		//@todo remove this, this is just for testing purpose.
		function cleanup () {
			removeDirectory (instance.path, this);
		},
		function directory () {
			prepareDirectory (instance.path, this);
		},
		function () {
			callback (null, instance);
		}
	);
};

/*
storage.pieceExists();
storage.blockExists();
storage.pieceValue();
storage.blockValue();
storage.savePiece();
storage.saveBlock();

torrent.storage.exists(piece);
torrent.storage.exists(block);
torrent.storage.get(block);
torrent.storage.save(block);
torrent.storage.save(piece);

pieces/
	-index/
		-blocks/
			-chunk.blob
		-data.blob
		*/