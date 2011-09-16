var Events = require("events");

// message contants.
exports.HANDSHAKE_VERIFIED = 'handShakeVerified';
exports.KEEP_ALIVE = 'keepalive';
exports.CHOKE = 0;
exports.UNCHOKED = 1;
exports.INTERESTED = 2;
exports.NOT_INTERESTED = 3;
exports.HAVE = 4;
exports.BITFIELD = 5;
exports.REQUEST = 6;
exports.PIECE = 7;
exports.CANCEL = 8;
exports.PORT = 9;

exports.factory = {
	// http://wiki.theory.org/BitTorrentSpecification#Handshake
	// handshake: <pstrlen><pstr><reserved><info_hash><peer_id>
	handshake: function (torrent) {
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
};

exports.Handler = function MessageHandler (socket, connectionInfo) {
	var instance = new Events.EventEmitter();
	var mHandshakeVerified = false;
	var mMessageBuffer = '';

	socket.on('data', onMessageReceived);
	
	function onMessageReceived (message) {
		// first message should be a echo of the sent handshake without the first byte (specifying the length).
		if (!mHandshakeVerified) {
			if (message.length < 68) {
				return;
			}

			var handshake = message.substring(0, 68);
			message = message.substring(68);
			mHandshakeVerified = true;

			instance.emit(exports.HANDSHAKE_VERIFIED);
		}
		
		mMessageBuffer += message;

		if (mMessageBuffer.length > 0) {
			handleMessage();
		}

		// recursive method because messages are sent in chunks.
		function handleMessage () {
			var buffer = new Buffer(mMessageBuffer, 'binary');
			if (buffer.length < 4) {
				return;
			}

			var messageLength = buffer.readInt32BE(0); 
			var totalLength = messageLength + 4;

			if (buffer.length < totalLength) {
				// console.log('%s:%d: message incomplete waiting for more data %d received %d required', connectionInfo.ip_string, connectionInfo.port, buffer.length, totalLength);
				return; // not enought data yet.
			}

			mMessageBuffer = mMessageBuffer.substring(totalLength);

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

			// console.log('%s:%d: message (id: %d) (length: %d) (payload: %d)', connectionInfo.ip_string, connectionInfo.port, id, messageLength, payload.length);

			switch (id) {
				case exports.CHOKE: // choke: <len=0001><id=0>
					instance.emit(exports.CHOKE);
				break;

				case exports.UNCHOKE: // unchoke: <len=0001><id=1>
					instance.emit(exports.UNCHOKE);
				break;

				case exports.INTERESTED: // interested: <len=0001><id=2>
					instance.emit(exports.INTERESTED);
				break;

				case exports.NOT_INTERESTED: // not interested: <len=0001><id=3>
					instance.emit(exports.NOT_INTERESTED);
				break;

				case exports.HAVE: //have: <len=0005><id=4><piece index>
					var piece = payload.readInt32BE(0);
					instance.emit(exports.HAVE, piece);
				break;

				// Some clients (Deluge for example) send bitfield with missing pieces even if it has all data. Then it sends rest of pieces as have messages. They are saying this helps against ISP filtering of BitTorrent protocol. It is called lazy bitfield.
				case exports.BITFIELD: // bitfield: <len=0001+X><id=5><bitfield>
					var availableIndexes = getAvailableIndexes(payload);
					instance.emit(exports.BITFIELD, availableIndexes);
				break;

				case exports.REQUEST: //request: <len=0013><id=6><index><begin><length>
					var index = payload.readInt32BE(0);
					var begin = payload.readInt32BE(4);
					var length = payload.readInt32BE(8);
					instance.emit(exports.REQUEST, index, begin, length);
				break;

				case exports.PIECE: // piece: <len=0009+X><id=7><index><begin><block>
					var index = payload.readInt32BE(0);
					var begin = payload.readInt32BE(4);
					var block = '';
					if (payload.length > 8) {
						block = payload.slice(8);
					}
					instance.emit(exports.PIECE, index, begin, block);
				break;

				case exports.CANCEL: // cancel: <len=0013><id=8><index><begin><length>
					var index = payload.readInt32BE(0);
					var begin = payload.readInt32BE(4);
					var length = payload.readInt32BE(8);
					instance.emit(exports.CANCEL, index, begin, length);
				break;

				case exports.PORT: // port: <len=0003><id=9><listen-port>
					var port = payload.readUInt16BE(0);
					instance.emit(exports.PORT, port);
				break;

				default: 
					console.log("unknown message");
				break;
			}

			handleMessage();
		}
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

	return instance;
};