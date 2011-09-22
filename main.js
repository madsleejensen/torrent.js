var Torrent = require('./torrent');

// prevent root access.
process.setgid(20);
process.setuid(501);

Torrent.create('test/thor.torrent', function (error, torrent) {
	if (error) {
		throw error;
		return;	
	}

	console.log(torrent.fileManager.files);

	torrent.download();

	//var datastream = torrent.createStream(process.stdout);
	//datastream.run();
});