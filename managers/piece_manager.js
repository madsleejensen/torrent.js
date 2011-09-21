/**
 * Keeps track on the *.torrent files pieces. 
 */
var Step = require('step');
var TaskQueue = require('./../taskqueue');
var Piece = require('./../piece');

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
	instance.getNextAvailablePiece = function (peer, exclude) {
		var available = peer.getAvailablePieces();
		if (available.length < 1) {
			return;
		}

		for (var i = 0; i < available.length; i++) {
			var index = available[i];
			if (instance.pieces[index].completed) {
				continue;
			}

			// piece is not wanted.
			if (exclude.indexOf(instance.pieces[index]) !== -1) { 
				continue;
			}

			//console.log(typeof instance.pieces[index]);
			return instance.pieces[index];
		}
	}

	Step( // initialize
		function createPieces () {

			// http://fileformats.wikia.com/wiki/Torrent_file
			if (typeof torrent.infomation.info.length != 'undefined') { // single file format;
			}
			else if (typeof torrent.infomation.info.files != 'undefined') { // multi file format;
				//console.log(torrent.info.files);	
			}

			var piecesCount = torrent.infomation.info.pieces.length / PIECE_HASH_BYTE_LENGTH;
			var length = torrent.infomation.info['piece length'];
			var pieces = [];

			for (var index = 0; index < piecesCount; index++) {
				var offset = index * PIECE_HASH_BYTE_LENGTH;
				var hash = torrent.infomation.info.pieces.substr(offset, PIECE_HASH_BYTE_LENGTH);
				var piece = Piece.create(index, hash, length);
				pieces[index] = piece;
			}
	
			console.log('piece length: %d. total pieces: %d', length, piecesCount);

			this (null, pieces);
		},
		function inflate (error, pieces) {
			if (error) throw error;
			instance.pieces = pieces;
			//return;
			return this();
			//var parallel = this.parallel();
			/*
			instance.pieces.forEach(function(piece) {
				instance.storage.inflate(piece, parallel());	
			});*/
		},
		function ready (error) {
			callback (null, instance);
		}
	);
};