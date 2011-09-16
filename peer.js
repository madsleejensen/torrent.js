var Network= require('net');
var Events = require('events');
var Message = require("./message");

var CONNECTION_TIMEOUT = 5000;
var MAXIMUM_PIECE_CHUNK_REQUESTS = 3; // number of chunk requests pr. peer.
//var PIECE_CHUNK_REQUEST_TIMEOUT = 3000;

// DONT send interrested() multiple times.
// prøv at send bitlist tilbage.
module.exports = function peer (connectionInfo) {
	var instance = new Events.EventEmitter();
	instance.connectionInfo = connectionInfo;
	instance.choked = true;
	instance.getAvailablePieces = function () {
		return mPiecesAvailable;	
	};

	var mKeepAliveInterval;
	var mSocket;
	var mPiecesAvailable = [];
	var mMessageHandler;
	var mRequestingBlocks = []; // list of requests currently being made on the peer.

	instance.handshake = function (torrent, callback) {
		mSocket = Network.createConnection(connectionInfo.port, connectionInfo.ip_string);
		mSocket.setEncoding('binary');
		mSocket.setNoDelay();
		mSocket.setTimeout(CONNECTION_TIMEOUT);

		mSocket.on('error', onClose);
		mSocket.on('end', onClose);
		mSocket.on('close', onClose);
		mSocket.on('timeout', onClose);
		mSocket.on('connect', function() {
			console.log("peer: %s:%d -connect", connectionInfo.ip_string, connectionInfo.port);
			
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
			}, 30000);

			instance.connectionInfo.state = 'active';
			instance.emit('state_changed', instance);
			instance.sender.handshake(torrent);
		});
		
		function onClose(error) {
			if (mKeepAliveInterval != null) {
				console.log("peer: %s:%d -closed", connectionInfo.ip_string, connectionInfo.port);
				//clearInterval(mKeepAliveInterval);
			}

			instance.connectionInfo.state = 'closed';
			instance.emit("state_changed", instance);
			mSocket.destroy();
		}
	};

	instance.download = function () {
		if (peer.choked ||
			instance.connectionInfo.state == 'closed' || 
			mRequestingBlocks.length > MAXIMUM_PIECE_CHUNK_REQUESTS) {
			return;
		}

		var piece = torrent.pieceManager.getNextAvailablePiece(instance);

		if (!piece) {
			return;
		}

		var blocks = piece.getMissingBlocks();

		for (var index in blocks) {
			var block = blocks[index];
			block.peers.push(instance);

			mRequestingBlocks.push(block);

			instance.sender.request(piece.index, block.begin, block.length);

			if (mRequestingBlocks.length > MAXIMUM_PIECE_CHUNK_REQUESTS) {
				break;
			}
		}
	};

	var handlers = {
		handshake_verified: function () {
			console.log("%s:%d -handshake verified", connectionInfo.ip_string, connectionInfo.port);
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
			instance.emit('pieces_available', instance);
			//instance.sender.request(piece, 0, Math.pow(2, 10));
			// console.log('%s:%d: [have] (index: %d)', connectionInfo.ip_string, connectionInfo.port, piece);
		},
		bitfield: function (availableIndexes) {
			console.log("%s:%d: [bitfield]", connectionInfo.ip_string, connectionInfo.port);
			mPiecesAvailable = mPiecesAvailable.concat(availableIndexes);
			instance.sender.interrested();
			instance.emit('pieces_available', instance);

		},
		request: function (index, begin, length) {
			
		},
		piece: function (index, begin, data) {
			console.log("%s:%d: [piece] (index: %d) (begin: %d) (block-size: %d)", connectionInfo.ip_string, connectionInfo.port, index, begin, data.length);
			
			// remove block from list.
			for (var i = 0; i < mRequestingBlocks.length; i++) {
				var block = mRequestingBlocks[i];

				if (block.piece.index == index && 
					block.begin == begin) {
					
					// cancel the rest of the peers attempting to request the block.
					block.peers.forEach(function (peer) {
						peer.sender.cancel (block.index, block.begin, block.length);						
					});
					block.setValue(data);

					mRequestingBlocks.splice(i, 1);
					break;
				}
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
			mSocket.write(message.toString('binary'), 'binary');
		},
		keepAlive: function () {
			var message = new Buffer(4);
			message.writeInt32BE(0, 0);
			mSocket.write(message.toString('binary'), 'binary');	
		},
		unchoke: function () {
			var message = new Buffer(5);
			message.writeInt32BE(/* length */ 1, 0);
			message.writeInt8(/* id */ 1, 4);
			
			mSocket.write(message.toString('binary'), 'binary');
		},
		interrested: function () {
			var message = new Buffer(5);
			message.writeInt32BE(/* length */ 1, 0);
			message.writeInt8(/* id */ 2, 4);
			
			mSocket.write(message.toString('binary'), 'binary');
		},
		cancel: function (index, begin, length) {
			var message = new Buffer(17);
			message.writeInt32BE(/* length */ 13, 0);
			message.writeInt8(6, 4); // id
			message.writeInt32BE(index, 5); // index
			message.writeInt32BE(begin, 9); // begin
			message.writeInt32BE(length, 13); // length

			mSocket.write(message.toString('binary'), 'binary');

			// remove from requesting blocks list.
			for (var i = 0; i < mRequestingBlocks.length; i++) {
				var block = mRequestingBlocks[i];

				if (block.piece.index == index && 
					block.begin == begin) {
					mRequestingBlocks.splice(i, 1);
					break;
				}
			}
		},
		request: function (index, begin, length) { // begin / length should be something in the power of 2. maximum Math.pow(2, 15)
			var message = new Buffer(17);
			message.writeInt32BE(/* length */ 13, 0);
			message.writeInt8(6, 4); // id
			message.writeInt32BE(index, 5); // index
			message.writeInt32BE(begin, 9); // begin
			message.writeInt32BE(length, 13); // length

			mSocket.write(message.toString('binary'), 'binary');
			console.log("%s:%d: [request] %d", connectionInfo.ip_string, connectionInfo.port, index, message.toString('hex'));

		}
	};

	return instance;
};