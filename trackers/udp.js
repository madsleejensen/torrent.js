var UDP = require("dgram");
var Bencoder = require('bencoder');
var Compact = require('./../compact');
var Peer = require('./../peer');
var Events = require("events");

var MAXIMUM_FAILED_ATTEMPTS = 3;

var ACTIONS = {
	CONNECT: 0,
	ANNOUNCE: 1,
	SCAPE: 2,
	ERROR: 3	
};

var EVENTS = {
	NONE: 0,
	COMPLETED: 1,
	STARTED: 2,
	STOPPED: 3
};

var LISTENING_PORT = 8111;

// http://www.rasterbar.com/products/libtorrent/udp_tracker_protocol.html#actions
// http://www.bittorrent.org/beps/bep_0015.html
exports.create = function UDPTracker (url) {
	
	var instance = new Events.EventEmitter();
	instance.url = url;
	instance.failed_attempts = 0;
	instance.socket = UDP.createSocket('udp4');

	var mTimeout = null;
	var mMinimumInterval = 60 * 1000;
	var mWorking = false; // to prevent multiple requests going on at the same time.
	var mWorkingTimeout = null;

	instance.start = function (torrent) {
		instance.torrent = torrent;
		instance.sender.connect();
	};

	instance.forceUpdate = function () {
		if (mWorking) return;
		mWorking = true;
		mWorkingTimeout = setTimeout(function() {
			mWorking = false;
		}, 1000);

		instance.sender.connect();
	};

	instance.sender = {
		connect: function () {
			// predefined value by protocol.
			var connectionId = new Buffer('0000041727101980', 'hex');
			var message = new Buffer(16);
			connectionId.copy(message, 0, 0, 8);
			message.writeInt32BE(ACTIONS.CONNECT, 8);
			message.writeInt32BE(createTransactionId(), 12);
			instance.socket.send(message, 0, message.length, instance.url.port, instance.url.hostname);
		},
		announce: function (connectionId, torrent) {
			var message = new Buffer(100);
			connectionId.copy(message); // 64 bit.
			message.writeInt32BE(ACTIONS.ANNOUNCE, 8); // 32 bit
			message.writeInt32BE(createTransactionId(), 12); // 32 bit
			instance.torrent.info_hash_buffer.copy(message, 16); // hash (20 bytes)
			instance.torrent.peer_id_buffer.copy(message, 36); // peer (20 bytes)
			message.writeInt32BE(0, 56) // downloaded (64 bit)
			message.writeInt32BE(0, 64) // left (64 bit)
			message.writeInt32BE(0, 72) // uploaded (64 bit)					
			message.writeInt32BE(EVENTS.NONE, 80) // event (32 bit)
			message.writeUInt32BE(0, 84) // IP (32bit) 0 == sender ip
			message.writeUInt32BE(0, 88) // key (32bit)
			message.writeInt32BE(-1, 92) // num_want (32bit) (-1 == default)
			message.writeUInt16BE(LISTENING_PORT, 96) // port
			message.writeUInt16BE(0, 98) // extensions

			instance.socket.send(message, 0, message.length, instance.url.port, instance.url.hostname);
		}	
	};

	function createTransactionId () {
		var maxIntegerValue = 2147483647; // (Math.pow(2, 32) / 2) - 1; divided because the value is not unsigned.
		return Math.round(Math.random() * maxIntegerValue);	
	}

	instance.socket.on('error', function () {
		console.log('error', arguments);
		instance.failed_attempts++;
	});

	instance.socket.on('message', function(message) {
		if (mWorkingTimeout) {
			clearTimeout(mWorkingTimeout);
		}

		mWorking = false;

		var action = message.readInt32BE(0);
		var transactionId = message.readInt32BE(4);

		switch (action) {
			case ACTIONS.CONNECT: // connection
				var connectionId = message.slice(8);
				instance.sender.announce (connectionId);
			break;

			case ACTIONS.ANNOUNCE: // announce response
				var interval = message.readInt32BE(8);
				var leechers = message.readInt32BE(12);
				var seeders = message.readInt32BE(16);
				var addresses = message.slice(20); // The rest of the server reply is a variable number of the following structure: [ip: 32 bit][port: 16 bit]
				var rawPeers = Compact.decode(addresses);
				var peers = [];

				rawPeers.forEach(function(connectionInfo) {
					var peer = Peer(connectionInfo);
					peers.push(peer);
				});

				mMinimumInterval = interval;
				if (mTimeout != null) {
					clearTimeout(mTimeout);
				}

				mTimeout = setTimeout(function() {
					instance.forceUpdate();
				}, mMinimumInterval);

				instance.failed_attempts = 0;
				instance.emit('new_peers', peers);
			break;

			case ACTIONS.ERROR: 
				console.log('udp-error');
			break;
		}
	});

	instance.socket.bind(LISTENING_PORT);

	return instance;
};