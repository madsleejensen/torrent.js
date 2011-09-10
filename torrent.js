var FileSystem = require('fs');
var Step = require('step');
var Events = require('events');
var Bencoder = require('./bencoder');
var Crypto = require('crypto');
var Tracker = require('./tracker');
var Piece = require('./piece');
var Peer = require("./peer");

var MAXIMUM_ACTIVE_PEERS = 50;
var PIECE_HASH_BYTE_LENGTH = 20;
var MAXIMUM_CONNECTING_PEERS = 100;

module.exports = function torrent (filepath, readyCallback) {
	var instance = new Events.EventEmitter();
		instance.on('new_peers_available', onPeersAvailable);

	var mInfomation;
	var mPieces;
	var mTrackers;

	var mPeers = []; // all peers that has ever been found for this torrent.
	var mNewPeers = []; // peers that has not yet been checked.
	var mActivePeers = []; // peers that has active connection.
	var mConnectingPeers = [];

	setInterval(function() {
		if (mActivePeers.length < 1) {
			return;		
		}

		mActivePeers.forEach(function(peer) {
			var available = peer.getAvailablePieces();
			if (available.length < 1) {
				return;
			}

			var index = available[0];
			var piece = mPieces[index];
		
			if (!peer.choked && peer.connectionInfo.state != 'closed') {
				//peer.sender.interrested();
				//peer.sender.unchoke();
				var chunks = piece.getBlockOffsets(3);
				chunks.forEach(function(chunk) {
					peer.sender.request(piece.index, chunk.begin, chunk.length);	
				});
			}
			
		});

	}, 500);

	function onPieceBlockReceived(index, begin, block) {
		console.log('received block');
		mPieces[index].addBlock(begin, block);
	}

	instance.download = function () {
		console.log('downloading: %s : %s', filepath, mInfomation.info.name);
		findPeers();
	};

	function findPeers () {
		if (mActivePeers.length < MAXIMUM_ACTIVE_PEERS) {
			mTrackers.forEach(function(tracker) {
				tracker.on('new_peers', function (peers) {
					onPeersReceived(null, peers);
				});
				tracker.start(mInfomation);
			});
		}
	}

	function forceUpdateTrackers () {
		mTrackers.forEach(function(tracker) {
			tracker.forceUpdate();
		});
	}

	function onPeersReceived (error, peers) {
		if (peers == null || peers.length < 1) {
			return;
		}

		peers.forEach(function(peer) {
			for (var index in mPeers) {
				if (mPeers[index].connectionInfo.hex === peer.connectionInfo.hex) {
					return; // peer already exists.
				}
			}

			mPeers.push(peer);
			mNewPeers.push(peer);
		});

		console.log('peers: %d unique', mPeers.length);
		instance.emit('new_peers_available');
	}

	// attempt to create a connection to a peer to filter out dead peers.
	function onPeersAvailable () {
		if (mConnectingPeers.length >= MAXIMUM_CONNECTING_PEERS) { // too many peers already being checked.
			return;
		}
		if (mNewPeers.length < 1) { // no peers to check
			//console.log('peers: ran out of peers starting to force request trackers.');
			forceUpdateTrackers();
			return;
		}

		var slotsAvailable = MAXIMUM_CONNECTING_PEERS - mConnectingPeers.length;
		var slots = Math.min(mNewPeers.length, slotsAvailable);
		var peers = mNewPeers.splice(0, slots);
		
		peers.forEach(function (peer) {
			mConnectingPeers.push(peer);
			peer.on('state_changed', onPeerStateChanged);
			peer.handshake(mInfomation);
		});

		function onPeerStateChanged (peer) {
			var index = mConnectingPeers.indexOf(peer);
			if (index != -1) {
				mConnectingPeers.splice(0, index); // remove.
			}

			if (peer.connectionInfo.state == 'active') {
				peer.removeAllListeners('block_received');
				peer.on('block_received', onPieceBlockReceived);
				mActivePeers.push(peer);
			}
			else if (peer.connectionInfo.state == 'closed') {
				var activeIndex = mActivePeers.indexOf(peer);
				if (activeIndex != -1) {
					mActivePeers.splice(0, activeIndex);
				}
			}

			onPeersAvailable();
		}
	}

	(function initialize() {
		Step (
			function decodeFile () {
				decodeTorrentFile(filepath, this);
			},
			function loadTrackers (error, infomation) {
				if (error) throw error;
				
				mInfomation = infomation;
				mInfomation.peer_id = 'qwertyuiopasdfghjxla';
				getTrackers(mInfomation, this);
			},
			function loadPieces (error, trackers) {
				if (error) throw error;

				mTrackers = trackers;
				getPieces(mInfomation, this);
			},
			function complete (error, pieces) {
				mPieces = pieces;
				readyCallback(error, instance);
			}
		);
	})()

	return instance;
};

function decodeTorrentFile (filepath, callback) {
	FileSystem.readFile(filepath, 'binary', function(error, data) {
		if (error) callback(error);

		var torrent = Bencoder.decode(data);
			torrent.info_hash = createInfoHash(torrent);

		callback(null, torrent);
	});
}

function createInfoHash (torrent) {
	var encodedInfoValue = Bencoder.encode(torrent.info);

	var shasum = Crypto.createHash('sha1');
		shasum.update(encodedInfoValue);

	return shasum.digest('hex');
};

function getTrackers (torrent, callback) {
	var uris = torrent['announce-list'];
	var trackers = [];

	uris.forEach(function(uri) {
		var	tracker = Tracker.create(uri[0]);
		if (tracker != null) {
			trackers.push(tracker);		
		}
	});

	callback(null, trackers);
}

function getPieces (torrent, callback) {
	// http://fileformats.wikia.com/wiki/Torrent_file
	if (typeof torrent.info.length !== 'undefined') { // single file format;
		
	}
	else if (typeof torrent.info.files !== 'undefined') { // multi file format;
		
	}

	var piecesCount = torrent.info.pieces.length / PIECE_HASH_BYTE_LENGTH;
	var length = torrent.info['piece length'];
	var pieces = [];
	Step(
		function load () {
			for (var index = 0; index < piecesCount; index++) {
				var offset = index * PIECE_HASH_BYTE_LENGTH;
				var hash = torrent.info.pieces.substr(offset, PIECE_HASH_BYTE_LENGTH);
				var piece = Piece(index, hash, length, this.parallel());
				pieces[index] = piece;
			}
		},
		function ready (error) {
			callback(error, pieces);
		}
	);

	console.log('piece length: %d. total pieces: %d', length, piecesCount);
}