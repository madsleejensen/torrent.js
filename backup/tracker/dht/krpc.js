// (K)ademlia (R)emote (P)rocedure (C)all
var bencoder = require('./bencoder');

var commands = {
	'type': 'y',
	'query': 'q', // ping, find_node, get_peers, announce_peer.
	'response': 'r',
	'error': 'e',
	'parameters': 'a',
	'transaction_id': 't' // 2 byte string value;
};

var transactionIds = [];

exports.createQuery = function (query, parameters, encode) {
	var request = {};
		request[commands.type] = commands.query;
		request[commands.query] = query;
		request[commands.parameters] = parameters;
		request[commands.transaction_id] = createTransactionId();

	return encode ? bencoder.encode(request) : request; 
};


exports.freeTransactionId = function (id) {
	var index = transactionIds.indexOf(id);
	if (index != -1) {
		transactionIds.splice(index, 1);
	}
};

// @todo get a ASCII character table up and create a two byte id instead of 1 byte.
function createTransactionId() {

	var random;
	do {
		
	 	random = parseInt(Math.random() * 255);
	 	random = random.toString(16); // hex value;

	} while (transactionIds.indexOf(random) != -1);

	transactionIds.push(random);

	return random;
}