/**
 * Managing all the peers found the the trackers for a given torrent.
 * Is responsible for categorising them by states and listen for state changes.
 */

var MAXIMUM_ACTIVE_PEERS = 50; // currently not being used.
var MAXIMUM_CONNECTING_PEERS = 100;

exports.create = function (torrent, callback) {
	
	var instance = {};
	var mPeers = []; // all peers that has ever been found for this torrent.
	var mNewPeers = []; // peers that has not yet been checked.
	var mActivePeers = []; // peers that has active connection.
	var mConnectingPeers = [];

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

		console.log('peers: %d unique', mPeers.length);
		onNewPeersAvailable();
	}


	// attempt to create a connection to a peer to filter out dead peers.
	function onNewPeersAvailable () {
		if (mConnectingPeers.length >= MAXIMUM_CONNECTING_PEERS) { // too many peers already being checked.
			return;
		}
		if (mNewPeers.length < 1) { // no peers to check
			//console.log('peers: ran out of peers starting to force request trackers.');
			torrent.trackerManager.forceStart();
			return;
		}

		var slotsAvailable = MAXIMUM_CONNECTING_PEERS - mConnectingPeers.length;
		var slots = Math.min(mNewPeers.length, slotsAvailable);
		var peers = mNewPeers.splice(0, slots);
		
		peers.forEach(function (peer) {
			mConnectingPeers.push(peer);
			peer.on('state_changed', onPeerStateChanged);
			peer.handshake(instance.infomation);
		});

		function onPeerStateChanged (peer) {
			var index = mConnectingPeers.indexOf(peer);
			if (index != -1) {
				mConnectingPeers.splice(index, 1); // remove.
			}

			if (peer.connectionInfo.state == 'active') {
				peer.removeAllListeners('block_received');
				peer.on('block_received', onPieceBlockReceived);
				mActivePeers.push(peer);
			}
			else if (peer.connectionInfo.state == 'closed') {
				var activeIndex = mActivePeers.indexOf(peer);
				if (activeIndex != -1) {
					mActivePeers.splice(activeIndex, 1);
					console.log("REMOVED ");
				}
			}

			onNewPeersAvailable();
		}
	}

	callback (null, instance);
};