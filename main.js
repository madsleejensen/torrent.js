var Torrent = require('./torrent');
var FileSystem = require('fs');

// prevent root access.
process.setgid(20);
process.setuid(501);

Torrent.create('test/thor.torrent', function (error, torrent) {
	if (error) {
		console.log('error', error);
		throw error;
		return;	
	}

	var file = torrent.fileManager.files[2];
	var stream = FileSystem.createWriteStream('downloads/' + file.path, {flags: 'w+', mode: 0777});
	file.pipe(stream);
	file.download();
});

/**
 @todo
 	-make it possible for the systemt to increase the maximum number of allowed peers pr. block.
 */