// http://fileformats.wikia.com/wiki/Torrent_file (Torrent file format)
// http://www.bittorrent.org/beps/bep_0005.html (DHT protocol)
// http://bittorrent.org/beps/bep_0003.html#the-connectivity-is-as-follows

// http://wiki.theory.org/BitTorrentSpecification#Peer_wire_protocol_.28TCP.29


// https://github.com/stbuehler/nodejs-dht-bencode/tree/master/lib
// https://github.com/stbuehler/node-dht

var dgram = require("dgram");
var dht = require("./dht");
var torrent = require("./torrent");
var queryString = require("querystring");
var transport = dgram.createSocket('udp4');

transport.on('error', function(error) {
	console.log('error');
});

transport.on('message', function(message, info) {
	console.log('transport -> message: [%s]',message.toString(), info);
	console.log("\n");
});

transport.on('listening', function() {
	console.log('transport: listening');
});

transport.on('close', function () {
	console.log('transport: closed');
});

transport.bind(8123);


var tracker = dht(transport, 'router.utorrent.com', 6881);

/*
tracker.ping (function (response) {

	tracker.getPeers(response.r.id, function (response) {
		console.log(response);
	});

});*/

torrent.openFile('torrent2.torrent', function (error, infomation) {
	if (error) {
		throw new Error(error.message);
	}

	var hash = new Buffer(infomation.info_hash, 'hex');
	tracker.getPeers(hash, function(response) {
		// den retunere 8 compact info (26byte objekter.)
		console.log(new Buffer(response.r.nodes).toString('utf8').length );
	});

	/*
		
	var test = {
		info_hash: '%fd%fd%fd%fdT%fd%1c%fd%fdV%fd%fd%0e%fd%fdP%2b%1f%03%fd',
		peer_id: 'abcdefghij0123456789',
		port: 8123,
		uploaded: 0,
		downloaded: 0
	};

	console.log(infomation.announce + '?' + queryString.stringify(test));
	return;
	var hash = new Buffer(infomation.info_hash, 'hex');
	console.log(escapeBinary(hash));


	//tracker.getPeers(infomation.info_hash);
	*/
});