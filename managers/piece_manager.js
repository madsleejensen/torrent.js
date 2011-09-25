/**
 * Keeps track on the *.torrent files pieces. 
 */
var Step = require('step');
var TaskQueue = require('./../taskqueue');
var Piece = require('./../piece');
var U = require('U');
var Events = require('events');

var PIECE_HASH_BYTE_LENGTH = 20;

exports.create = function PieceManager (torrent, callback) {
	var instance = new Events.EventEmitter();
	instance.pieces = [];
	instance.storage = torrent.storage;
	instance.currentFile = null;

	/* NOT USED ANY LONGER BECAUSE MOST OF THE LOGIC FOR DETERMINING WITCH PIECES / BLOCKS TO DOWNLOAD HAS BEEN MOVED TO THE DOWNLOADER.
	
	// find the next piece to download that is available for the peer.
	instance.getNextAvailablePiece = function (peer, exclude) {
		var available = peer.getAvailablePieces();
		if (available.length < 1) {
			return;
		}

		for (var i = 0; i < available.length; i++) {
			var index = available[i];
			var piece = instance.pieces[index];

			if (instance.pieces[index].completed) {
				continue;
			}

			// piece is not wanted.
			if (exclude.indexOf(instance.pieces[index]) !== -1) { 
				continue;
			}
			
			return instance.pieces[index];
		}
	};

	instance.getNextBlocks = function (peer, limit) {
		var exclude = []; // list of pieces not to ignore in piece pieceManager.getNextAvailablePiece();
		var result = [];

		while (limit > 0) {
			var piece = instance.getNextAvailablePiece(peer, exclude);
			if (!piece) {
				break;
			}

			var blocks = piece.blocks.getMissing();
			// no missing blocks, probably because all blocks are currently "full" @see block.isFull();
			if (blocks.length <= 0) {
				exclude.push(piece);
				continue;
			}

			for (var index = 0; index < blocks.length && limit > 0; index++) {
				var block = blocks[index];
				result.push(block);
				limit--;
			}
		}

		return result;
	};
	*/

	function onPieceComplete (piece) {
		instance.emit('piece:completed', piece);
	}

	Step( // initialize
		function createPieces () {
			var piecesCount = torrent.infomation.info.pieces.length / PIECE_HASH_BYTE_LENGTH;
			var pieceLength = torrent.infomation.info['piece length'];
			var pieces = [];

			for (var index = 0; index < piecesCount; index++) {
				var offset = index * PIECE_HASH_BYTE_LENGTH;
				var hash = torrent.infomation.info.pieces.substr(offset, PIECE_HASH_BYTE_LENGTH);
				var piece = Piece.create(torrent, index, hash, pieceLength, this.parallel());
				piece.on('piece:completed', onPieceComplete);
				pieces[index] = piece;
			}

			console.log('pieces: [length: %d] [count: %d] \n', pieceLength, piecesCount);
			instance.pieces = pieces;
		},
		function inflate (error) {
			if (error) throw error;
			//return;
			return this();
			//var parallel = this.parallel();
			/*
			instance.pieces.forEach(function(piece) {
				instance.storage.inflate(piece, parallel());	
			});*/
		},
		function ready (error) {
			callback (error, instance);
		}
	);
};