var Buffer = require('buffer').Buffer;

var COMPACT_ADDRESS_BYTE_LENGTH = 6;

exports.decode = function (buffer) { 
	if (buffer.constructor !== Buffer) {
		buffer = new Buffer(buffer); 
	}
	
	var pointer = 0;
	var addresses  = [];

	while (pointer < buffer.length) {

		var rest = buffer.length - pointer;
		var end = pointer + Math.min(COMPACT_ADDRESS_BYTE_LENGTH, rest);
		var chunk = buffer.slice(pointer, end);
		var address = decodeCompactAddress(chunk);
		
		if (address) {
			addresses.push(address);	
		}

		pointer += COMPACT_ADDRESS_BYTE_LENGTH;		
	}

	return addresses;
};

function decodeCompactAddress (buffer) { // <ip><port> length: 6bytes
	if (buffer.length < COMPACT_ADDRESS_BYTE_LENGTH) {
		return null;
	}

	var ip = [];
		ip[0] = buffer.readUInt8(0);
		ip[1] = buffer.readUInt8(1);
		ip[2] = buffer.readUInt8(2);
		ip[3] = buffer.readUInt8(3);

	var port = buffer.readUInt16BE(4); 

	return {
		hex: buffer.toString('hex'),
		port: port,
		ip: ip,
		ip_string: ip.join('.')
	};
}


exports.encode = function(ip, port) {
	
};