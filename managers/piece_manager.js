var Step = require('step');
var TaskQueue = require('./../taskqueue');
var Piece = require('./../piece');
var U = require('U');
var Events = require('events');
var Config = require('./../config');

/**
 * Initialize the pieces, that represent the entire torrent file. Will inflate them with data if available thru the @storage_manager
 */
exports.create = function PieceManager (torrent, callback) {
	var instance = new Events.EventEmitter();
	instance.pieces = [];
	instance.storage = torrent.storage;
	instance.currentFile = null;

	function onPieceComplete (piece) {
		instance.emit('piece:completed', piece);
	}

	Step( // initialize
		function createPieces () {
			var piecesCount = torrent.infomation.info.pieces.length / Config.PIECE_HASH_BYTE_LENGTH;
			var pieceLength = torrent.infomation.info['piece length'];
			var pieces = [];

			for (var index = 0; index < piecesCount; index++) {
				var offset = index * Config.PIECE_HASH_BYTE_LENGTH;
				var hash = torrent.infomation.info.pieces.substr(offset, Config.PIECE_HASH_BYTE_LENGTH);
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