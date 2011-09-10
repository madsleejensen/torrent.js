// (D)istributed (H)ash (T)able
// http://www.bittorrent.org/beps/bep_0005.html
var krpc = require("./krpc");
var bencoder = require("./bencoder");

module.exports = function dht (transport, host, port) {
	
	var nodeId = 'abcdefghij0123456789';
	var callbacks = {};
	var instance = {};

	transport.on('message', onResponseReceived);

	instance.ping = function (callback) {
		var request = krpc.createQuery('ping', {id: nodeId});
		send(request, callback);

		return request.t; // return transaction id.
	};

	instance.getPeers = function (hash, callback) {
		var request = krpc.createQuery('get_peers', {id: nodeId, info_hash: hash});
		send(request, callback);

		return request.t;
	};

	instance.findNode = function (targetNodeId, callback) {
		var request = krpc.createQuery('find_node', {id: nodeId, target: targetNodeId});
		send(request, callback);
		
		return request.t;
	};

	function onResponseReceived (message, info) {
		var raw = message.toString('binary');
		var response = bencoder.decode(raw);
		
		switch (response.y) {
			case 'r':
				var transactionId = response.t;
				if (callbacks[transactionId]) {
					callbacks[transactionId](response);
					callbacks[transactionId] = null;
				}

			break;
		}

		krpc.freeTransactionId(response.t);
	}

	function send (request, callback) {
		if (callback) {
			callbacks[request.t] = callback;
		}

		console.log('dht: request', request);
		console.log("\n");

		var buffer = bencoder.encodeToBuffer(request);

		transport.send(buffer, 0, buffer.length, port, host, function (error, bytes) {
			if (error) {
				throw new Error(error.message);
			}

			console.log("dht: sent [%s] %d bytes", buffer, bytes);
		});
	}

	return instance;
};