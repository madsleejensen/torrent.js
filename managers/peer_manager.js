var U = require('U');
var Events = require('events');
var Config = require('./../config');
/**
 * Managing all the peers found the the trackers for a given torrent.
 * Is responsible for categorising them by states and listen for state changes.
 */

exports.create = function (torrent, callback) {
	
	var instance = new Events.EventEmitter();
	var mPeers = []; // all peers that has ever been found for this torrent.
	var mNewPeers = []; // peers that has not yet been checked.
	var mActivePeers = []; // peers that has active connection.
	var mConnectingPeers = [];
	var mReQueuePeers = []; // peers that are to be tested again for connection.
	var mLastActivePeerCount = 0;
 
	instance.getActive = function () {
		return mActivePeers;
	};

	instance.getConnecting = function () {
		return mConnectingPeers;
	};
	
	// return peers that at the moment has slots available for requests.
	instance.getFreePeers = function () {
		return U.array.find(mActivePeers, function(peer) {
			return peer.hasRequestSlotsAvailable();
		});
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
		if (mConnectingPeers.length >= Config.MAXIMUM_CONNECTING_PEERS) { // too many peers already being checked.
			return;
		}
		if (Config.MAXIMUM_ACTIVE_PEERS != -1 && mActivePeers.length >= Config.MAXIMUM_ACTIVE_PEERS) { // too many open connections.
			return;
		}
		if (mNewPeers.length < 1) { // no peers to check
			//console.log('peers: ran out of peers starting to force request trackers.');
			torrent.trackerManager.forceStart();
			return;
		}

		var slotsAvailable = Config.MAXIMUM_CONNECTING_PEERS - mConnectingPeers.length;
		slotsAvailable = Math.min(mNewPeers.length, slotsAvailable);
		var slots = mNewPeers.splice(0, slotsAvailable);

		slots.forEach(function(peer) {
			mConnectingPeers.push(peer);
			peer.on('peer:state_changed', onPeerStateChanged);
			peer.handshake(torrent);
		});
	}

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
			else if (peer.failedAttempts < Config.MAXIMUM_CONNECTION_ATTEMPTS) {
				mReQueuePeers.push(peer);
			}
		}
		onNewPeersAvailable();
	}

	// requeue peers if enough time has expired.
	function reQueuePeers () {
		if (mReQueuePeers.length <= 0) {
			return;
		}

		var candidateTime = process.uptime() - Config.SECONDS_BETWEEN_CONNECTION_ATTEMPTS;

		mReQueuePeers.forEach(function (peer) {
			if (peer.lastAttemptTime > candidateTime) {
				return; // wait abit longer to test this conneciton again.
			}

			mNewPeers.push(peer);
			U.array.remove(mReQueuePeers, peer);
		});
	}

	// check if theres been changes in the mActivePeer list since last execution 
	// runs as a interval to prevent "spammy" event publishing.
	function notifyChangesInActivePeers () {
		if (mActivePeers.length !== mLastActivePeerCount) {
			instance.emit('active_peer_count:changed');
		}
	}

	setInterval(reQueuePeers, Config.SECONDS_BETWEEN_CONNECTION_ATTEMPTS * 1000);
	setInterval(notifyChangesInActivePeers, 500);
	setInterval(function() { // just a bit of infomation.
		console.log('peers: [unique: %d] [new: %d] [connecting: %d] [active: %d]', mPeers.length, mNewPeers.length, mConnectingPeers.length, mActivePeers.length);
	}, 10000);

	callback (null, instance);
};