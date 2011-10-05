var Torrent = require('./../torrent');

module.exports = new function TorrentManager () {
	var instance = {};
	instance.torrents = {};

	instance.get = function (filepath, callback) {
		var key = filepath.toLowerCase();

		if (typeof instance.torrents[key] === 'undefined') {
			Torrent.create(filepath, function (error, torrent) {
				instance.torrents[key] = torrent;
				callback (error, torrent);
			});
		}
		else {
			callback (null, instance.torrents[key]);			
		}
	};

	return instance;
};