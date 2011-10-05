var Events = require ('events');
var Step = require('step');
var TaskQueue = require('./taskqueue');
var DownloadItem = require('./download_item');
var Downloader = require('./downloader');
var U = require('U');
/**
 * Represent a file to be downloaded, as described in the *.torrent file. File data specifications are created as @download_item instances.
 */
module.exports = function (torrent, path, length, requirements) {
	var instance = new Events.EventEmitter();
	instance.path = path;
	instance.length = length;
	instance.requirements = requirements;
	instance.completed = false;
	instance.downloadItems = [];
	instance.downloader = null;
	instance.activeConnections = [];

	instance.download = function (destination) {
		console.log('downloading: [file: %s] [size: %s]', instance.path, instance.length);

		if (instance.downloader === null) {
			instance.downloader = Downloader.create(torrent, instance);
		}

		if (instance.activeConnections.indexOf(destination) === -1) {
			instance.activeConnections.push(destination);
			instance.pipe(destination);
		}

		onDownloadItemCompleted(); // check if file already been downloaded.
	};

	instance.cancel = function (destination) {
		U.array.remove(instance.activeConnections, destination);
	};

	instance.isActive = function () {
		return (instance.activeConnections.length > 0);
	};

	/**
     * takes a destination stream, and pipe data to it as the file gets loaded. Much like the core Stream.pipe() method would.
     * this method will only work well if the @downloader is using a sequential block priority algorithm.
     */
	instance.pipe = function (destination) {
		var queue = instance.createStreamQueue(destination);
		queue.on('end', function() {
			destination.end();
		});
		queue.run();
	};

	instance.createStreamQueue = function (destination) {
		var task = new TaskQueue();

		instance.downloadItems.forEach(function(item) {
			task.queue (function (callback) {
				var itemTask = item.createStreamQueue(destination);	
				itemTask.on('end', function () {
					callback ();
				});
				itemTask.run();
			});
		});
		
		return task;
	};

	function onDownloadItemCompleted () {
		if (!U.array.contains(instance.downloadItems, {completed: false})) {
			instance.emit('file:completed', instance);
		}
	}

	Step(
		function createDownloadItems () {	
			for (var i = 0; i < instance.requirements.length; i++) {
				var requirement = instance.requirements[i];
				var item = new DownloadItem (requirement);
				item.once('download_item:completed', onDownloadItemCompleted);
				instance.downloadItems.push(item);
			}	
		}
	);

	return instance;
};