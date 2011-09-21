var Network= require('net');
var Events = require('events');
var Message = require("./message");
var U = require('U');

// @todo implement fast track http://bittorrent.org/beps/bep_0006.html

var CONNECTION_TIMEOUT = 5000;
var MAXIMUM_PIECE_CHUNK_REQUESTS = 6; // number of chunk requests pr. peer. (http://wiki.theory.org/Talk:BitTorrentSpecification#Algorithms:_Queuing)
var PEER_REQUEST_TIMEOUT = 3000;

module.exports = function peer (connectionInfo) {
	var instance = new Events.EventEmitter();
	instance.connectionInfo = connectionInfo;
	instance.choked = false;
	instance.hasBeenActive = false;
	instance.failedAttempts = 0;
	instance.torrent = null;
	instance.getAvailablePieces = function () {
		return mPiecesAvailable;	
	};

	var mKeepAliveInterval;
	var mSocket;
	var mPiecesAvailable = [];
	var mMessageHandler;
	var mRequestingBlocks = []; // list of requests currently being made on the peer.

	instance.handshake = function (torrent) {
		mSocket = Network.createConnection(connectionInfo.port, connectionInfo.ip_string);
		mSocket.setEncoding('binary');
		mSocket.setNoDelay();
		mSocket.setTimeout(CONNECTION_TIMEOUT);

		mSocket.on('error', onClose);
		mSocket.on('end', onClose);
		mSocket.on('close', onClose);
		mSocket.on('timeout', onClose);
		mSocket.on('connect', function() {
			//console.log("peer: %s:%d -connect", connectionInfo.ip_string, connectionInfo.port);
			
			mMessageHandler = new Message.Handler(mSocket, connectionInfo);
			mMessageHandler.on(Message.HANDSHAKE_VERIFIED, handlers.handshake_verified);
			mMessageHandler.on(Message.CHOKE, handlers.choke);
			mMessageHandler.on(Message.UNCHOKE, handlers.unchoke);
			mMessageHandler.on(Message.INTERESTED, handlers.interested);
			mMessageHandler.on(Message.NOT_INTERESTED, handlers.not_interested);
			mMessageHandler.on(Message.HAVE, handlers.have);
			mMessageHandler.on(Message.BITFIELD, handlers.bitfield);
			mMessageHandler.on(Message.REQUEST, handlers.request);
			mMessageHandler.on(Message.PIECE, handlers.piece);
			mMessageHandler.on(Message.CANCEL, handlers.cancel);
			mMessageHandler.on(Message.PORT, handlers.port);

			mSocket.setTimeout(0); // disable timeout when connected.
			mKeepAliveInterval = setInterval(function() {
				instance.sender.keepAlive();
			}, 3000);

			instance.connectionInfo.state = 'active';
			instance.hasBeenActive = true;
			instance.emit('peer:state_changed', instance);
			instance.sender.handshake(torrent);
			instance.torrent = torrent;
		});
		
		function onClose(error) {
			if (mKeepAliveInterval != null) {
				//console.log("peer: %s:%d -closed", connectionInfo.ip_string, connectionInfo.port);
				clearInterval(mKeepAliveInterval); // this cause spammy close events.
			}

			if (!instance.hasBeenActive) {
				instance.failedAttempts++;
			}

			instance.connectionInfo.state = 'closed';
			instance.emit("peer:state_changed", instance);
			
			if (mSocket != null) {
				mSocket.destroy();
				mSocket = null;
			}
		}
	};
	
	instance.download = function () {

		if (instance.choked ||
			instance.connectionInfo.state == 'closed' || 
			mRequestingBlocks.length >= MAXIMUM_PIECE_CHUNK_REQUESTS) {
			return;
		}

		var slotsAvailable = MAXIMUM_PIECE_CHUNK_REQUESTS - mRequestingBlocks.length;
		var exclude = []; // list of pieces not to ignore in piece pieceManager.getNextAvailablePiece();

		while (slotsAvailable > 0) {
			var piece = instance.torrent.pieceManager.getNextAvailablePiece(instance, exclude);
			if (!piece) {
				break;
			}

			var blocks = piece.getMissingBlocks();
			// no missing blocks, probably because all blocks are currently "full" @see block.isFull();
			if (blocks.length <= 0) {
				exclude.push(piece);
				continue;
			}

			for (var index = 0; index < blocks.length && slotsAvailable > 0; index++) {
				var block = blocks[index];
				block.peers.push(instance);

				(function scope () {
					var track = {
						block: block,
						timeout: setTimeout (function () {
							cleanupBlockTrack (track);
						}, PEER_REQUEST_TIMEOUT)
					};

					mRequestingBlocks.push(track);
					instance.sender.request(piece.index, block.begin, block.length);
				})();

				slotsAvailable--;
			}
		}
	};

	instance.reset = function () {
		instance.failedAttempts = 0;
		instance.hasBeenActive = false;
		instance.choked = false;
		instance.removeAllListeners();
	};

	function cleanupBlockTrack (track) {
		if (track.timeout) {
			clearTimeout(track.timeout);
		}

		U.array.remove(track.block.peers, instance);
		U.array.remove(mRequestingBlocks, track);
	}

	var handlers = {
		handshake_verified: function () {
			//console.log("%s:%d -handshake verified", connectionInfo.ip_string, connectionInfo.port);
		},
		choke: function () {
			instance.choked = true;
		},
		unchoke: function () {
			instance.choked = false;
			instance.emit(Message.UNCHOKE);
		},
		interested: function () {
			
		},
		not_interested: function () {
			
		},
		have: function (index) {
			mPiecesAvailable.push(index);
			mPiecesAvailable.sort(U.sorting.numeric_asc);
			instance.emit('pieces_available', instance);
			// console.log('%s:%d: [have] (index: %d)', connectionInfo.ip_string, connectionInfo.port, piece);
		},
		bitfield: function (availableIndexes) {
			//console.log("%s:%d: [bitfield]", connectionInfo.ip_string, connectionInfo.port);
			mPiecesAvailable = mPiecesAvailable.concat(availableIndexes);
			mPiecesAvailable.sort(U.sorting.numeric_asc);
			instance.sender.interrested();
			instance.emit('pieces_available', instance);
		},
		request: function (index, begin, length) {
			
		},
		piece: function (index, begin, data) {
			//console.log("block (index: %d) (begin: %d) (completed: %d)", index, begin);
			var track = U.array.findOne(mRequestingBlocks, {'block.piece.index': index, 'block.begin': begin});

			if (track) {
			
				track.block.setValue(data);
				track.block.peers.forEach(function (peer) {
					peer.sender.cancel (track.block.piece.index, track.block.begin, track.block.length);						
				});
				
				cleanupBlockTrack (track);
			}

			instance.download();
		},
		cancel: function () {
		},
		port: function (port) {	
		}
	};

	instance.sender = {
		handshake: function(torrent) {
			var message = Message.factory.handshake(torrent);
			instance.sender.send(message);
		},
		keepAlive: function () {
			var message = new Buffer(4);
			message.writeInt32BE(0, 0);
			instance.sender.send(message);
		},
		unchoke: function () {
			var message = new Buffer(5);
			message.writeInt32BE(/* length */ 1, 0);
			message.writeInt8(/* id */ 1, 4);
			instance.sender.send(message);
		},
		interrested: function () {
			var message = new Buffer(5);
			message.writeInt32BE(/* length */ 1, 0);
			message.writeInt8(/* id */ 2, 4);
			instance.sender.send(message);
		},
		cancel: function (index, begin, length) {
			// remove from requesting blocks list.
			var track = U.array.findOne(mRequestingBlocks, {'block.piece.index': index, 'block.begin': begin});
			if (track) {
				cleanupBlockTrack (track);

				var message = new Buffer(17);
				message.writeInt32BE(/* length */ 13, 0);
				message.writeInt8(6, 4); // id
				message.writeInt32BE(index, 5); // index
				message.writeInt32BE(begin, 9); // begin
				message.writeInt32BE(length, 13); // length

				instance.sender.send(message);
			}
		},
		request: function (index, begin, length) { // begin / length should be something in the power of 2. maximum Math.pow(2, 15)
			var message = new Buffer(17);
			message.writeInt32BE(/* length */ 13, 0);
			message.writeInt8(6, 4); // id
			message.writeInt32BE(index, 5); // index
			message.writeInt32BE(begin, 9); // begin
			message.writeInt32BE(length, 13); // length

			//console.log("%s:%d: [request] %d", connectionInfo.ip_string, connectionInfo.port, index, message.toString('hex'));
			instance.sender.send(message);
		},
		send: function (buffer) {
			if (mSocket != null) {
				try {
					mSocket.write(buffer);
				}
				catch (e) {
					console.log('peer->sender->send');
					console.log(e);
				}
			}
		}
	};

	return instance;
};