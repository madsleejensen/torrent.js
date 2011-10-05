var Events = require('events');

module.exports = function TaskQueue () {
	var instance = new Events.EventEmitter();
	var mTaskQueue = [];
	var mIsRunning = false;

	instance.queue = function (task) {
		mTaskQueue.push(task);
	};

	instance.run = function () {
		runTask();
	};

	instance.cancel = function () {
		mIsRunning = false;
	};

	function runTask () {
		if (mTaskQueue.length < 1) {
			instance.emit ('end');
			return;
		}

		if (mIsRunning) return;
		mIsRunning = true;

		var task = mTaskQueue.shift();
		task(onTaskCompleted);
	}

	function onTaskCompleted (error, data) {
		if (error) {
			throw error;
		}

		instance.emit ('data', data);

		mIsRunning = false;
		runTask(); // recurse
	}

	return instance;
}