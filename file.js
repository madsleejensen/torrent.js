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
	instance.bytesCompleted = 0;
	
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

	instance.getFirstItem = function () {
		return instance.downloadItems[0];
	};

	instance.getLastItem = function () {
		var index = instance.downloadItems.length - 1;
		return instance.downloadItems[index];
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

	function onDownloadItemCompleted (downloadItem) {
		instance.bytesCompleted = calculateBytesCompleted();

		if (downloadItem) {
			var percentage = Math.round((instance.length / instance.bytesCompleted) * 100);
			var index = instance.downloadItems.indexOf(downloadItem);
			console.log('file: %s downloaded [item: %d] (%d % completed) [total: %d kb] [completed: %d kb]', instance.path, index, percentage, Math.round(instance.length / 1024), Math.round(instance.bytesCompleted / 1024));
		}
		
		if (!U.array.contains(instance.downloadItems, {completed: false})) {
			instance.emit('file:completed', instance);
		}
	}

	function calculateBytesCompleted() {
		var bytes = 0;
		for (var i = 0; i < instance.downloadItems.length; i++) {
			var item = instance.downloadItems[i];
			
			bytes += item.bytesCompleted;

			if (!item.completed) {
				break;
			}
		}

		return Math.min(bytes, instance.length);
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