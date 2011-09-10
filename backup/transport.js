var net  = require("net");


module.exports = function server (port) {
	var torrents = [];

	var tcpServer = net.createServer(function (socket) {
		
			
		socket.on('connect', function() {
			console.log('tcp: connected');
		});

		socket.on('data', function(data) {
			console.log('tcp:', data);
		});

		socket.on('end', function() {
			console.log('tcp: end');
		});
	});

	tcpServer.listen(listenPort);



};

var torrents = [];

function createPeerId () {
	
};



torrent = torrent.create('torrent.torrent');

tracker.on('peers_received', function(peers) {
	
});

tracker.request(torrent);