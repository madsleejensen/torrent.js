var Torrent = require('./torrent');
var FileSystem = require('fs');
var WebServer = require('./web/server');

// prevent root access.
process.setgid(20);
process.setuid(501);

WebServer.listen(8222);
return;

Torrent.create('test/thor.torrent', function (error, torrent) {
	if (error) {
		console.log('error', error);
		throw error;
		return;	
	}


	var file = torrent.fileManager.files[2];
	/*var stream = FileSystem.createWriteStream('downloads/' + file.path, {flags: 'w+', mode: 0777});
	file.pipe(stream);
	file.download();
	*/


});


/**
 @todo
 	-make it possible for the systemt to increase the maximum number of allowed peers pr. block.
 		- set a limit on how "far" it should attempt to download pieces, that way you get more active peers you can use for downloading the important pieces.
 		- prioritise best connection (determine the download speed).
 			-good connections can have much more active requests than now (like 40-50). use Wireshark to see how uTorrent is handling queuing.

 	:memory
		-make file storage work.
			-on each block store the a timestamp for when it was downloaded and run a interval to persist them into files after a given periode.
		-lazy load the creation of block specifications.
		-refactor the most used instances, away from the module pattern and into a prototype pattern to save memory.

 	-add DHT support.
 	- make peer exchange support http://da.wikipedia.org/wiki/Peer_exchange
 	- make http://en.wikipedia.org/wiki/Local_Peer_Discovery
 	-add fast peer support.

 	-download is not safe, because partial pieces and not validated because not all blocks are downloaded.
 	-maybe @downloader shoudl be taken out of the torrent dependencies that way the downloader can be used on different torrents at the same time.

 	-(facebook ticker integration :)  ... "Mads is watching ..... click to watch.".


 	-Each file should instantiate its own downloader, else multiple files can not be downloaded at the same time.

 */