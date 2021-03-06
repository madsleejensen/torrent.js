var Network= require('net');
var Events = require('events');
var Message = require("./message");
var U = require('U');
var Config = require('./config');
var SpeedCalculator = require('./speed_calculator');

module.exports = function peer (connectionInfo) {
	var instance = new Events.EventEmitter();
	instance.connectionInfo = connectionInfo;
	instance.choked = false;
	instance.hasBeenActive = false;
	instance.failedAttempts = 0;
	instance.torrent = null;
	instance.maximumConcurrentRequests = Config.Peer.MAXIMUM_PIECE_CHUNK_REQUESTS;

	instance.stats = {
		avarageRespondTime: null, // ms
		requestsCompleted: 0,
		download: null,
	};

	var mLastMaximumRequestsAdjustment = null;

	instance.getAvailablePieces = function () {
		return mPiecesAvailable;	
	};

	instance.getRequestSlotsAvailable = function () {
		return 	mRequestingBlocks.length < instance.maximumConcurrentRequests;
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
		mSocket.setTimeout(Config.Peer.CONNECTION_TIMEOUT);

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

			instance.connectionInfo.state = 'awaiting_handshake_verification';
			instance.hasBeenActive = true;
			instance.emit('peer:state_changed', instance);
			instance.sender.handshake(torrent);
			instance.torrent = torrent;
		});
		
		function onClose(error) {
			if (mKeepAliveInterval != null) {
				clearInterval(mKeepAliveInterval);
				mKeepAliveInterval = null;
			}

			if (!instance.hasBeenActive) {
				instance.failedAttempts++;
				instance.lastAttemptTime = process.uptime();
			}

			instance.connectionInfo.state = 'closed';
			instance.emit("peer:state_changed", instance);
			
			if (mSocket != null) {
				mSocket.destroy();
				mSocket = null;
			}

			if (instance.stats.download !== null) {
				instance.stats.download.destroy();
				instance.stats.download = null;	
			}
		}
	};
	
	instance.download = function (block, downloader) {
		if (instance.choked ||
			instance.connectionInfo.state == 'closed' || 
			mRequestingBlocks.length >= Config.Peer.MAXIMUM_PIECE_CHUNK_REQUESTS) {
			return;
		}

		var requestTime = new Date().getTime();
		var track = { // used for timeout handling.
			block: block,
			downloader: downloader,
			time: requestTime,
			timeout: setTimeout (function () {
				cleanupBlockTrack (track);
			}, Config.Peer.REQUEST_TIMEOUT)
		};

		block.lastRequestTime = requestTime;

		mRequestingBlocks.push(track);
		instance.sender.request(block.piece.index, block.begin, block.length);

		return true;
	};

	instance.reset = function () {
		instance.failedAttempts = 0;
		instance.hasBeenActive = false;
		instance.choked = false;
		instance.lastAttemptTime = null;
		instance.removeAllListeners();
	};

	function cleanupBlockTrack (track) {
		if (track.timeout) {
			clearTimeout(track.timeout);
		}

		U.array.remove(track.block.peers, instance);
		U.array.remove(mRequestingBlocks, track);
	}

	function updateAvarageRespondTime (respondTime) {

		instance.stats.requestsCompleted++;

		if (respondTime !== instance.stats.avarageRespondTime) {
			var delta = respondTime - instance.stats.avarageRespondTime;
			var effect = delta / instance.stats.requestsCompleted;
			instance.stats.avarageRespondTime += effect;
				
			// adjust the number of concurrent requests that is appropriate for this peer. 
			var currentTime = new Date().getTime(); // used to limit the adjustment a bit.
			if (mLastMaximumRequestsAdjustment === null || (currentTime - mLastMaximumRequestsAdjustment) > instance.stats.avarageRespondTime) {
				var maxRequests = instance.maximumConcurrentRequests;

				// if avarage respond time is higher than whats optimal, try lowering the amount of concurrent requests this peer has.
				if (instance.stats.avarageRespondTime > Config.Peer.OPTIMAL_RESPONSE_TIME) {
					var delta = Config.Peer.OPTIMAL_RESPONSE_TIME / instance.stats.avarageRespondTime;
					var decreasePercentage = delta / 100
					var decrease = Math.ceil(decreasePercentage * maxRequests);
					/*
					if (maxRequests > 8) {
						console.log('\n\ndecrease\n\n',decrease,  decreasePercentage, maxRequests);
					}*/

					maxRequests -= decrease;
					maxRequests = Math.max(Config.Peer.MINIMUM_PIECE_CHUNK_REQUESTS, maxRequests);
				}
				else {
					maxRequests++;
					//console.log('this is a super fast peer respond time: ', instance.stats.avarageRespondTime, instance.maximumConcurrentRequests, instance.connectionInfo.hex);
				}

				instance.maximumConcurrentRequests = maxRequests;
				mLastMaximumRequestsAdjustment = currentTime;
			}
		}
	};

	var handlers = {
		handshake_verified: function () {
			instance.stats.download = new SpeedCalculator();
			instance.connectionInfo.state = 'active';
			instance.emit('peer:state_changed', instance);
			//console.log("%s:%d -handshake verified", connectionInfo.ip_string, connectionInfo.port);
		},
		choke: function () {
			instance.choked = true;
			instance.emit(Message.CHOKE);
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
			//console.log("block (index: %d) (begin: %d)", index, begin);
			instance.stats.download.addBytes(data.length);
			
			var track = U.array.findOne(mRequestingBlocks, {'block.piece.index': index, 'block.begin': begin});

			if (track) {
				var respondTime = new Date().getTime() - track.time;
				updateAvarageRespondTime (respondTime);

				track.block.setValue(data);
				track.block.peers.forEach(function (peer) {
					peer.sender.cancel (track.block.piece.index, track.block.begin, track.block.length);						
				});
				
				cleanupBlockTrack (track);
				track.downloader.addPeerBlockRequests(instance); // @todo there can be a little delay here this could be optimized so no matter if track exists or not it should attempt to do new requests.
			}
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
		request: function (index, begin, length) { // begin / length should be something in the power of 2. maximum Math.pow(2, 14)
			var message = new Buffer(17);
			message.writeInt32BE(/* length */ 13, 0);
			message.writeInt8(6, 4); // id
			message.writeInt32BE(index, 5); // index
			message.writeUInt32BE(begin, 9); // begin
			message.writeInt32BE(length, 13); // length

			//console.log("%s:%d: [request] %d", connectionInfo.ip_string, connectionInfo.port, index, begin);
			instance.sender.send(message);

		},
		send: function (buffer) {
			if (mSocket != null) {
				try {
					mSocket.write(buffer);
				}
				catch (e) {
					console.log('peer->sender->send', e.message);
				}
			}
		}
	};

	return instance;
};