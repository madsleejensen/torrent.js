var Torrent = require('./torrent');
var Downloader = require('./downloader');

// prevent root access.
process.setgid(20);
process.setuid(501);

Torrent.create('test/thor.torrent', function (error, torrent) {
	if (error) {
		console.log('error', error);
		throw error;
		return;	
	}

	var file = torrent.fileManager.files[6];
	torrent.download(file);

	//var file = torrent.fileManager.files[4];
	//file.download(); 
	/*file.createStream(process.stdout); */
	//torrent.download();
	//var datastream = torrent.createStream(process.stdout);
	//datastream.run();
});