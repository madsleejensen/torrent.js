/**
 * Keeps track on the *.torrent files pieces. 
 */
var Step = require('step');
var TaskQueue = require('./taskqueue');

var PIECE_HASH_BYTE_LENGTH = 20;

exports.create = function PieceManager (torrent, callback) {
	var instance = {};
	instance.pieces = [];
	instance.storage = torrent.storage;

	instance.getNextPiece = function () {
		for (var index in instance.pieces) {
			var piece = instance.pieces[index];
			if (!piece.completed) {
				return piece;
			}
		}
	};

	// find the next piece to download that is available for the peer.
	instance.getNextAvailablePiece = function (peer) {
		var available = peer.getAvailablePieces();
		if (available.length < 1) {
			return;
		}

		for (var i in available) {
			var index = available[i];
			if (!instance.pieces[index] || instance.pieces[index].completed) {
				continue;
			}
			return instance.pieces[index];
		}
	}

	Step( // initialize
		function createPieces () {
			// http://fileformats.wikia.com/wiki/Torrent_file
			if (typeof torrent.info.length !== 'undefined') { // single file format;
			}
			else if (typeof torrent.info.files !== 'undefined') { // multi file format;
			}

			var piecesCount = torrent.info.pieces.length / PIECE_HASH_BYTE_LENGTH;
			var length = torrent.info['piece length'];
			var pieces = [];

			for (var index = 0; index < piecesCount; index++) {
				var offset = index * PIECE_HASH_BYTE_LENGTH;
				var hash = torrent.info.pieces.substr(offset, PIECE_HASH_BYTE_LENGTH);
				var piece = Piece(index, hash, length);
				pieces[index] = piece;
			}

			this (null, pieces);
			console.log('piece length: %d. total pieces: %d', length, piecesCount);
		},
		function inflate (error, pieces) {
			if (error) throw error;
			this();
			return;
			var parallel = this.parallel();
			
			instance.pieces = pieces;
			instance.pieces.forEach(function(piece) {
				instance.storage.inflate(piece, parallel());	
			});
		},
		function ready (error) {
			callback (null, instance);
		}
	);
};