var TorrentManager = require('./../managers/torrent_manager');
var FileSystem = require('fs');

TorrentManager.get('./torrents/thor.torrent', function(error, torrent) {
	if (!error) {
		// torrent initialized. 
		var file = torrent.fileManager.files[2]; // pick the first file in the torrent.
		var outputStream = FileSystem.createWriteStream('./examples/downloads/' + file.path, {flags: 'w+', mode: 0777});

		file.download(outputStream);
	}
});