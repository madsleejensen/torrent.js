var Events = require ('events');
var Step = require('step');
var TaskQueue = require('./taskqueue');
var DownloadItem = require('./download_item');
var U = require('U');
/**
 * Represent a file to be downloaded, as described in the *.torrent file.
 */
module.exports = function (torrent, path, length, requirements) {
	var instance = new Events.EventEmitter();
	instance.path = path;
	instance.length = length;
	instance.requirements = requirements;
	instance.completed = false;
	instance.downloadItems = [];

	instance.download = function () {
		torrent.download(instance);
	};

	/**
     * takes a destination stream, and pipe data to it as the file gets loaded. Much like the core Stream.pipe() method would.
     * this method will only work well if the @downloader is using a sequential block priority algorithm.
     */
	instance.pipe = function (destination) {
		var queue = instance.createStreamQueue(destination);
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