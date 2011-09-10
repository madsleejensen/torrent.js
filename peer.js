var Network= require('net');
var Events = require('events');

var CONNECTION_TIMEOUT = 5000;

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
	var mHandshakeVerified = false;
	var mPiecesAvailable = [];

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
			var handshake = handshakeBuffer(torrent);
			mSocket.setTimeout(0); // disable timeout when connected.
			mSocket.write(handshake.toString('binary'), 'binary');
			mSocket.on('close', function() {
				clearInterval(mKeepAliveInterval);
				console.log("peer: %s:%d -close", connectionInfo.ip_string, connectionInfo.port);
			});

			mKeepAliveInterval = setInterval(function() {
				instance.sender.keepAlive();
			}, 30000);

			instance.connectionInfo.state = 'active';
			instance.emit('state_changed', instance);
		});

		mSocket.on('data', onMessageReceived);
		
		function onClose(error) {
			instance.connectionInfo.state = 'closed';
			instance.emit("state_changed", instance);
			mSocket.destroy();
		}
	};

	// messages comes in chunks, so we need to buffer them.
	var messageBuffer = '';

	function onMessageReceived (message) {
		// first message should be a echo of the sent handshake without the first byte (specifying the length).
		if (!mHandshakeVerified) {
			if (message.length < 68) {
				return;
			}

			var handshake = message.substring(0, 68);
			message = message.substring(68);
			mHandshakeVerified = true;

			console.log('%s:%d: handshake verified', connectionInfo.ip_string, connectionInfo.port);
		}
		
		messageBuffer += message;

		if (messageBuffer.length > 0) {
			handleMessage();
		}

		function handleMessage () {
			var buffer = new Buffer(messageBuffer, 'binary');

			if (buffer.length < 4) {
				return;
			}

			var messageLength = buffer.readInt32BE(0); 
			var totalLength = messageLength + 4;

			if (buffer.length < totalLength) {
				console.log('%s:%d: message incomplete waiting for more data %d received %d required', connectionInfo.ip_string, connectionInfo.port, buffer.length, totalLength);
				return; // not enought data yet.
			}

			messageBuffer = messageBuffer.substring(totalLength);

			if (messageLength == 0) { // keep alive
				console.log('%s:%d: keep alive', connectionInfo.ip_string, connectionInfo.port);
				return;
			}

			var id = buffer.readInt8(4);

			var payload = '';

			if (buffer.length > 5 && messageLength > 1) {
				var end = 5 + (messageLength - 1);
				payload = buffer.slice(5, end); // rest is payload.
			}

			console.log('%s:%d: message (id: %d) (length: %d) (payload: %d)', connectionInfo.ip_string, connectionInfo.port, id, messageLength, payload.length);

			switch (id) {
				case 0: // choke: <len=0001><id=0>
					instance.choked = true;
				break;

				case 1: // unchoke: <len=0001><id=1>
					console.log("UNCHOKED");
					instance.choked = false;
					/*
					if (mPiecesAvailable.length > 0) {
						instance.sender.request(mPiecesAvailable[0], 0, Math.pow(2, 5));
					}*/
				break;

				case 2: // interested: <len=0001><id=2>
				break;

				case 3: // not interested: <len=0001><id=3>
				break;

				case 4: //have: <len=0005><id=4><piece index>
					var piece = payload.readInt32BE(0);
					mPiecesAvailable.push(piece);
					instance.emit('pieces_available', instance);
					//instance.sender.request(piece, 0, Math.pow(2, 10));
					// console.log('%s:%d: [have] (index: %d)', connectionInfo.ip_string, connectionInfo.port, piece);
				break;

				// Some clients (Deluge for example) send bitfield with missing pieces even if it has all data. Then it sends rest of pieces as have messages. They are saying this helps against ISP filtering of BitTorrent protocol. It is called lazy bitfield.
				case 5: // bitfield: <len=0001+X><id=5><bitfield>
					console.log("%s:%d: [bitfield]", connectionInfo.ip_string, connectionInfo.port);

					mPiecesAvailable = mPiecesAvailable.concat(getAvailableIndexes(payload));

					//mSocket.write(buffer.slice(0, totalLength), 'binary');

					instance.sender.interrested();
					instance.emit('pieces_available', instance);

				break;

				case 6: //request: <len=0013><id=6><index><begin><length>
				break;

				case 7: // piece: <len=0009+X><id=7><index><begin><block>
					var index = payload.readInt32BE(0);
					var begin = payload.readInt32BE(4);
					var block = '';
					if (payload.length > 8) {
						block = payload.slice(8);
					}
					console.log("%s:%d: [piece] (index: %d) (begin: %d) (block-size: %d)", connectionInfo.ip_string, connectionInfo.port, index, begin, block.length);
					
					instance.emit('block_received', index, begin, block);
					//instance.sender.request(mPiecesAvailable[0], 0, Math.pow(2, 10));
				break;

				case 8: // cancel: <len=0013><id=8><index><begin><length>
				break;

				case 9: // port: <len=0003><id=9><listen-port>
				break;

				default: 
					console.log("unknown message");
				break;
			}

			handleMessage();
		}
	}
	
	// http://wiki.theory.org/BitTorrentSpecification#Handshake
	// handshake: <pstrlen><pstr><reserved><info_hash><peer_id>
	function handshakeBuffer(torrent) {
		var identifier = "BitTorrent protocol";
		var handshake = new Buffer(49 + identifier.length);
		var infohash = new Buffer(torrent.info_hash, 'hex');
		var offset = 0;

		handshake.writeUInt8(identifier.length, 0, true);
		offset += 1;
		handshake.write(identifier, 1, identifier.length, 'binary');
		offset += identifier.length;

		handshake[offset] = 0; // reserved byte;
		handshake[offset + 1] = 0; // reserved byte;
		handshake[offset + 2] = 0; // reserved byte;
		handshake[offset + 3] = 0; // reserved byte;
		handshake[offset + 4] = 0; // reserved byte;
		handshake[offset + 5] = 0; // reserved byte;
		handshake[offset + 6] = 0; // reserved byte;
		handshake[offset + 7] = 0; // reserved byte;
		offset += 8; // reserved 8 bytes;

		infohash.copy(handshake, offset);
		offset += infohash.length; // 20 bytes
		handshake.write(torrent.peer_id, offset, 20);
		return handshake;
	}

	// piece index avalibility is represented as a bit flag every byte represent 8 index.
	function getAvailableIndexes (buffer) {	
		var result = [];
		for (var byteIndex = 0; byteIndex < buffer.length; byteIndex++) {
			var bitfield = buffer.readUInt8(byteIndex).toString(2);
			
			var add = 8 - bitfield.length;
			for (var n = 0; n < bitfield.length; n++) {
				if (bitfield[n] == 1) {
					var index = (byteIndex * 8) + n + add;
					result.push(index);
					//console.log("index", index);
				}
			}
			//console.log(bitfield);
		}

		return result;
	}

	instance.sender = {
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