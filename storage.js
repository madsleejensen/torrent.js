var FileSystem = require('fs');
var Path = require('path');
var Step = require('step');

module.exports = function Storage (torrent, callback) {
	var instance = {};
		instance.path = './storage/' + torrent.infomation.info_hash + '/';

	// takes a newly created piece object and inflate it with persisted data.
	instance.inflate = function (piece, callback) {
		getMetaDataByIndex(piece.index, function(error, metadata) {
			if (!error) {
				
			}

			callback (null, piece); 
		});
	};

	function getMetaDataByIndex (index, callback) {
		Step (
			function exists () {
				var callback = this;
				Path.exists(filepath, function (exists) {
					if (exists) {
						callback();
					}
					else {
						callback ('no meta file found.');
					}
				});
			},
			function read (error) {
				if (error) throw error;
				FileSystem.readFile(filepath, 'utf8', this);
			},
			function decode (error, data) {
				if (error) {
					callback(error);
					return;
				}

				try {
					var metadata = JSON.parse(data);	
					callback (null, metadata);
				}
				catch (e) {
					callback (e);
				}

				// hvordan "vågner" jeg objekterne op igen.
				// måske "inflate" objekterne med værdier istedet?.
			}
		);
	}


	instance.store = function (piece, callback) {
		
		Step(
			function createDirectory () {
				createDirectory (getBlockDirectoryPath(piece), this);
			},
			function storeData () {
				var callback = this;
				var newBlocks = []; // only store blocks that has not yet been stored in file.
				for (var index in piece.blocks) {
					var block = piece.blocks[index];
					if (block.storage == 'memory') {
						newBlocks.push(block);
					}
				}

				// recursively stores all new blocks in the file system.
				function storeBlock () {
					if (newBlocks.length < 1) {
						callback();
						return;
					}

					var block = newBlocks.pop();
					var filepath = Path.join(getBlockDirectoryPath(piece), block.offset + '.tmp');

					Step (
						function open () {
							FileSystem.open(filepath, 'w', 0777, this);
						},
						function write (error, fileDescriptor) {
							if (error) throw error;
							var callback = this;
							var buffer = new Buffer(block.data);
							FileSystem.write(fileDescriptor, buffer, 0, buffer.length, null, function (error) {
								callback(error, fileDescriptor);
							});
						},
						function close (error, fileDescriptor) {
							if (error) throw error;
							FileSystem.close(fileDescriptor, this);
						},
						function recurse (error) {
							if (error) throw error;
							block.storage = 'file';
							block.data = null; // remove data from memory.
							storeBlock();
						}
					)
				}

				storeBlock();
			},
			function storeMetaData () {
				var callback = this;

				openPieceMetaFile (piece, function (error, fileDescriptor) {
					if (error) throw error;
					var json = JSON.stringify(piece, null, 2);
					var buffer = new Buffer(json);

					FileSystem.write(fileDescriptor, buffer, 0, buffer.length, null, function (error) {
						if (error) throw error;

						FileSystem.close(fileDescriptor, function () {
							callback (error);
						});
					});
				});
			},
			function combinePieceFileIfCompleted (error) {
				if (error) {
					callback(error);
					return;
				}

				if (piece.isComplete()) {
					createPieceFile(piece, callback);
				}
				else {
					callback();
				}
			}
		);
	};

	function openPieceMetaFile (piece, callback) {
		var filepath =  Path.join(instance.path, piece.index + '.json');
		FileSystem.open(filepath, 'w', 0777, function(error, fileDescriptor) {
			callback (error, fileDescriptor);
		});
	}

	// get path to where the piece, block files are located.
	function getBlockDirectoryPath (piece) {
		var filepath =  Path.join(instance.path, piece.index, 'blocks/');
		return filepath;
	}

	// combines all the block files into a "piece" file.
	function createPieceFile (piece, callback) {
		var filepath =  Path.join(instance.path, piece.index + '.tmp');
		var pieceStream = FileSystem.createWriteStream(filepath, {flags: 'w', mode: 0777});
		var blocksDirectory = getBlockDirectoryPath(piece);
		
		Step (
			function listFiles () {
				FileSystem.readdir(blocksDirectory, this);
			},
			function sortFiles (error, files) {
				if (error) throw error;

				files.sort(function sortASC (file, compare) { 
					return parseInt(compare) - parseInt(file);
				});

				this (null, files);
			},
			function combine (error, files) {
				if (error) throw error;
				var callback = this;

				function transfer () { // transfer block data into the piece file.
					if (files.length < 1) {
						callback();
						return;
					}

					var filepath = Path.join(blocksDirectory, files.pop());
					console.log(filepath);
					var blockStream = FileSystem.createReadStream(filepath, {flags: 'r'});
					blockStream.on('end', function () {
						//blockStream.destroy(); // virker ikke?.
						transfer();
					});
				
					blockStream.pipe(pieceStream, {end: false});
				}

				transfer();
			},
			function cleanup (error) {
				pieceStream.destroy();
				callback(error);
			}
		);
	}

	function createDirectory (path, callback) {
		Path.exists(path, function(exists) {
			if (!exists) {
				FileSystem.mkdir(path, 0777, callback);
			}
			else {
				callback();
			}
		}); 
	}

	Step(
		function directory () {
			createDirectory (instance.path, this); // create storage directory.
		},
		function ready (error) {
			/*
			var piece = {
				index: 1,
				length: 2048,
				blocks: [
					{offset: 0, data: 'kkkkk', storage: 'memory'},
					{offset: 50, data: 'mmmmm', storage: 'memory'},
					{offset: 100, data: 'zzzzz', storage: 'memory'},
					{offset: 200, data: 'yyyyy', storage: 'memory'}
				]
			};
			
			instance.store(piece, function () {
				console.log("stored");

				piece.blocks.push( {offset: 20, data: "hello", storage: 'memory'});
				instance.store(piece, function () {
					console.log('finish');
				});

			});
			*/
			
			callback(error);
		}
	);
};