var Torrent = require('./torrent');

// prevent root access.
process.setgid(20);
process.setuid(501);

Torrent.create('test/thor.torrent', function (error, torrent) {
	if (error) {
		throw error;
		return;	
	}

	//var file = torrent.fileManager.files[4];
	//file.download(); 
	/*file.createStream(process.stdout); */
	torrent.download();
	//var datastream = torrent.createStream(process.stdout);
	//datastream.run();
});