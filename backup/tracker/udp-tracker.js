var dgram = require("dgram");
//var bigint = require("./bigint");
var socket = dgram.createSocket('udp4');

socket.on('message', function() {
	console.log('message', arguments);
});

socket.on('error', function() {
	console.log('error');
});

socket.bind(8111);

// https://github.com/substack/node-bigint

var part1 = parseInt('00100111000100000001100110000000', 2);
var part2 = parseInt('00000000000000000000010000010111', 2);

var connectionId = 0x41727101980; // connection id.
var buffer = new Buffer(16);
	buffer[0] = part1 & 0xFF;
	buffer[1] = part1 >>> 8 & 0xFF;
	buffer[2] = part1 >>> 16 & 0xFF;
	buffer[3] = part1 >>> 24 & 0xFF;
	buffer[4] = part2 & 0xFF;
	buffer[5] = part2 >>> 8 & 0xFF;
	buffer[6] = part2 >>> 16 & 0xFF;
	buffer[7] = part2 >>> 24 & 0xFF;
	buffer[8] = 0; // action
	buffer[9] = 0;
	buffer[10] = 0;
	buffer[11] = 0;
	buffer[12] = 0xFF; // transaction id
	buffer[13] = 0;
	buffer[14] = 0;
	buffer[15] = 0;
	
socket.send(buffer, 0, buffer.length, 80, 'tracker.openbittorrent.com', function() {
	console.log(arguments);
});


