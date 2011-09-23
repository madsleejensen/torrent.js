/**
 * Each *.torrent file contains a set of trackers, the TrackerManager is responsible for controlling these and
 * push the received peers to the PeerManager.
 */
var Tracker = require('./../trackers/tracker');
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

		setInterval(instance.forceStart, 8000);
	};

	// Force tracker update, that does not take 'min-inteval' into account.
	instance.forceStart = function () {
		console.log('force-start');
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

			console.log('trackers: ');

			uris.forEach(function(uri) {
				var	tracker = Tracker.create(uri[0]);
				if (tracker != null) {
					console.log('\t tracker: [uri: %s]', uri[0]);
					trackers.push(tracker);		
				}
			});

			console.log('');

			instance.trackers = trackers;

			callback (null, instance);
		}
	);
};