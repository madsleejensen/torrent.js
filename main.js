var Torrent = require('./torrent');

// prevent root access.
process.setgid(20);
process.setuid(501);

Torrent.create('test/thor.torrent', function (error, torrent) {
	if (error) {
		console.log(error);
		return;	
	}

	torrent.download();

	//var datastream = torrent.createDataStream(process.stdout);
	//datastream.run();
});