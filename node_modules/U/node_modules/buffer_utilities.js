// Note that all binary data in the URL (particularly info_hash and peer_id) must be properly escaped. This means any byte not in the set 0-9, a-z, A-Z, '.', '-', '_' and '~', must be encoded using the "%nn" format, where nn is the hexadecimal value of the byte. (See RFC1738 for details.)
exports.encodeToHttp = function (buffer) {
	var encoded = '';
	for (var index = 0; index < buffer.length; index++) {
		var binary = buffer.toString('binary', index, index + 1);

		if (/^[0-9a-zA-Z-_.~]$/.test(binary)) {
			encoded += binary;
		}
		else {
			var hex = buffer.toString('hex', index, index + 1);
			encoded += '%' + hex;
		}
	}

	return encoded;
};