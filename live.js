var U = require('U');
var Events = require('events');

var Live = new function () {

	var instance = {};
	var mGroups = {};

	instance.prepare = function (name, callback) {
		if (typeof mGroups[name] != 'undefined') {
			throw new Error('group [name: %s] already taken', name);
		}
	
		var group = new Group(callback);
		mGroups[name] = group;

		return group;
	};


	instance.push = function (group, data) {
		if (mGroups[group]) {
			var group = mGroups[group];
			group.push (data);
		}
	};

	return instance;
};

var Group = function (callback) {
	var instance = {};
	instance.callback = callback;
	instance.push = function (data) {
		callback.call (instance, data);
	};

	return instance;
};


var bandwidth = Live.prepare('bandwidth', function (data) {
	if (!this.downloaded) {
		this.downloaded = 0;	
	}

	this.downloaded += data.downloaded;
	console.log(this);
});

Live.push('bandwidth', {downloaded: 100});
Live.push('bandwidth', {downloaded: 100});

Live.on('bandwidth', function (data) {
});


/*
live.push('peers', {active_peers: 123});
live.prepare('peers', function () {
});

// de skal kunne gemme state hver gruppe.
Live.group('transfer', function onData(data) {
	this.speed = data.length; // this refer to the transfer object where you can store state.
		
});

Live.push('transfer', {download: 20});



live.push('block:1', {data_received: 123});
*/