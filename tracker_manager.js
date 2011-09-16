/**
 * Each *.torrent file contains a set of trackers, the TrackerManager is responsible for controlling these and
 * push the received peers to the PeerManager.
 */
var Tracker = require('./tracker');
var Step = require('step');

exports.create = function TrackerManager (torrent, callback) {
	var instance = {};
	instance.started = false;
	instance.trackers = [];
		
	instance.start = function () {
		if (instance.started) {
			return;
		}
		instance.started = true;

		instance.trackers.forEach(function(tracker) {
			tracker.on('new_peers', function (peers) {
				onPeersReceived(null, peers);
			});
			tracker.start(torrent.infomation);
		});
	};

	// Force tracker update, that does not take 'min-inteval' into account.
	instance.forceStart = function () {
		instance.trackers.forEach(function(tracker) {
			tracker.forceUpdate();
		});
	};

	function onPeersReceived (error, peers) {
		if (error) throw error;
		torrent.peerManager.add(peers);
	}

	Step (
		function init () {
			var uris = torrent.infomation['announce-list'];
			var trackers = [];

			uris.forEach(function(uri) {
				var	tracker = Tracker.create(uri[0]);
				if (tracker != null) {
					trackers.push(tracker);		
				}
			});

			instance.trackers = trackers;

			callback (null, instance);
		}
	);
};