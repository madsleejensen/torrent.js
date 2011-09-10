var Torrent = require('./torrent');
//var child = require("child_process");

// prevent root access.
process.setgid(20);
process.setuid(501);

var test = Torrent('test/thor.torrent', function (error, torrent) {
	if (error) {
		console.log(error);
		return;	
	}

	torrent.download();
});

/*
child.exec("ulimit -n", function(error, response) {
	console.log(response);
});
*/