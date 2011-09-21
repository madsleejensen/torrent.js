var DHT = require('./dht');
var dht = new DHT.DHT(51414);

// DHT.debug = true;

// for bootstrapping you need to know a node which already is in the dht
dht.start(); 
dht.bootstrap([ { 'address': 'router.utorrent.com', 'port': 6881 } ]);

var id = DHT.util.hex2buf("640FE84C613C17F663551D218689A64E8AEBEABE");

dht.lookup(id, function (peers, finished) {
	console.log("Found more peers: %j", peers);
	if (finished) console.log("Lookup done");
});
