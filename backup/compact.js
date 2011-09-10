var COMPACT_ADDRESS_BYTE_LENGTH = 6;

exports.decode = function (binary) { 

	var buffer = new Buffer(binary, 'binary');
	var pointer = 0;
	var addresses  = [];

	while (pointer < binary.length) {
		var rest = buffer.length - pointer;
		var chunk = buffer.slice(pointer, Math.min(COMPACT_ADDRESS_BYTE_LENGTH, rest));
		var address = decodeCompactAddress(chunk);

		addresses.push(address);

		pointer += COMPACT_ADDRESS_BYTE_LENGTH;		
	}

	return addresses;
};

function decodeCompactAddress (buffer) { // <ip><port> length: 6bytes
	var ip = [];
	if (buffer.length >= 4) {	
		ip[0] = buffer.readUInt8(0, 'big');
		ip[1] = buffer.readUInt8(1, 'big');
		ip[2] = buffer.readUInt8(2, 'big');
		ip[3] = buffer.readUInt8(3, 'big');
	}

	var port = null; 

	if (buffer.length >= COMPACT_ADDRESS_BYTE_LENGTH) {
		port = buffer.readUInt16(4, 'big');
	}

	return {
		port: port,
		ip: ip,
		ip_string: ip.join('.')
	};
}


exports.encode = function(ip, port) {
	
};