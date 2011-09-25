var U = require('U');

/**
 * Managing all the peers found the the trackers for a given torrent.
 * Is responsible for categorising them by states and listen for state changes.
 */

var MAXIMUM_ACTIVE_PEERS = -1; // -1 == unlimited
var MAXIMUM_CONNECTING_PEERS = 150;
var MAXIMUM_CONNECTION_ATTEMPTS = 2;
var SECONDS_BETWEEN_CONNECTION_ATTEMPTS = 5;

exports.create = function (torrent, callback) {
	
	var instance = {};
	var mPeers = []; // all peers that has ever been found for this torrent.
	var mNewPeers = []; // peers that has not yet been checked.
	var mActivePeers = []; // peers that has active connection.
	var mConnectingPeers = [];
	var mReQueuePeers = []; // peers that are to be tested again for connection.
 
	instance.getActive = function () {
		return mActivePeers;
	};

	instance.getConnecting = function () {
		return mConnectingPeers;
	};
	
	instance.add = function (peers) {
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

		//console.log('peers: [unique: %d] [new: %d] [connecting: %d] [active: %d]', mPeers.length, mNewPeers.length, mConnectingPeers.length, mActivePeers.length);
		onNewPeersAvailable();
	}

	// attempt to create a connection to a peer to filter out dead peers.
	function onNewPeersAvailable () {
		if (torrent.isActive === false) { // torrent is not requesting any data.
			return;	
		}
		if (mConnectingPeers.length >= MAXIMUM_CONNECTING_PEERS) { // too many peers already being checked.
			return;
		}
		if (MAXIMUM_ACTIVE_PEERS != -1 && mActivePeers.length >= MAXIMUM_ACTIVE_PEERS) { // too many open connections.
			return;
		}
		if (mNewPeers.length < 1) { // no peers to check
			//console.log('peers: ran out of peers starting to force request trackers.');
			torrent.trackerManager.forceStart();
			return;
		}

		var slotsAvailable = MAXIMUM_CONNECTING_PEERS - mConnectingPeers.length;
		slotsAvailable = Math.min(mNewPeers.length, slotsAvailable);
		var slots = mNewPeers.splice(0, slotsAvailable);

		slots.forEach(function(peer) {
			mConnectingPeers.push(peer);
			peer.on('peer:state_changed', onPeerStateChanged);
			peer.handshake(torrent);
		});

		function onPeerStateChanged (peer) {
			U.array.remove(mConnectingPeers, peer);
			
			if (peer.connectionInfo.state == 'active') {
				mActivePeers.push(peer);
			}
			else if (peer.connectionInfo.state == 'closed') {
				U.array.remove(mActivePeers, peer);

				// if peer has been active before, give it a chance again.
				if (peer.hasBeenActive) { 
					peer.reset();
					mReQueuePeers.push(peer);
				}
				// if peer has not reached connection attempt limit, queue it again.
				else if (peer.failedAttempts < MAXIMUM_CONNECTION_ATTEMPTS) {
					mReQueuePeers.push(peer);
				}
			}

			onNewPeersAvailable();
		}
	}

	// requeue peers if enough time has expired.
	function reQueuePeers () {
		if (mReQueuePeers.length <= 0) {
			return;
		}

		var candidateTime = process.uptime() - SECONDS_BETWEEN_CONNECTION_ATTEMPTS;

		mReQueuePeers.forEach(function (peer) {
			if (peer.lastAttemptTime > candidateTime) {
				return; // wait abit longer to test this conneciton again.
			}

			mNewPeers.push(peer);
			U.array.remove(mReQueuePeers, peer);
		});
	}

	setInterval(reQueuePeers, SECONDS_BETWEEN_CONNECTION_ATTEMPTS * 1000);

	setInterval(function() { // just a bit of infomation.
		console.log('peers: [unique: %d] [new: %d] [connecting: %d] [active: %d]', mPeers.length, mNewPeers.length, mConnectingPeers.length, mActivePeers.length);
	}, 10000);

	callback (null, instance);
};