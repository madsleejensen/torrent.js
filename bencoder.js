var Buffer = require("buffer").Buffer;

function encodeToBuffer (value) {
	var output = null;

	switch (true) {
		case typeof value == 'number':
			output = append(output, encodeInteger(value));
		break;
		
		case typeof value == 'string':
			output = append(output, encodeString(value));
		break
		
		case value.constructor === Buffer:
			// this only allows for String buffers to work, put the type responsiblity outside the encoder.
			var length = value.length + ':';
			length = new Buffer(length);
			output = append(output, length);
			output = append(output, value);
		break;

		case value.constructor === Array:
			output = append(output, encodeList(value));
		break;
		
		default:
			output = append(output, encodeDictionary(value));
		break;
	}
	
	function encodeDictionary(dictionary) {
		var string = new Buffer('d');
		
		for (var member in dictionary) {
			var key = member.length + ':' + member;
			var value = encodeToBuffer(dictionary[member]);
			
			string = append(string, new Buffer(key));
			string = append(string, value);
		}

		string = append(string, new Buffer('e'));
		return string;
	}
	
	function encodeList(list) {
		var string = new Buffer('l');
		
		for (var index in list) {
			string = append (string, encode(list[index]));
		}
		
		string = append (string, new Buffer('e'));
		
		return string;
	}
	
	function encodeString(string) {
		var string = Buffer.byteLength(string) + ':' + string;
		return new Buffer(string);
	}
	
	function encodeInteger(integer) {
		var integer = 'i' + integer.toString() + 'e';
		return new Buffer(integer);
	}
	
	// create a new buffer with the values of the passed in buffers.
	function append (a, b) {
		if (!a) {
			return b;
		}

		var size = a.length + b.length;
		var buffer = new Buffer(size);
		
		a.copy(buffer, 0, 0, a.length);
		b.copy(buffer, a.length, 0, b.length);

		return buffer;
	}

	return output;
}

exports.encodeToBuffer = encodeToBuffer;

// encode a javascript value into bencode. 
function encode (value) {
	var output = '';
	
	switch (true) {
		case typeof value == 'number':
			output += encodeInteger(value);
		break;
		
		case typeof value == 'string':
			output += encodeString(value);
		break
		
		case value.constructor === Array:
			output += encodeList(value);
		break;
		
		default:
			output += encodeDictionary(value);
		break;
	}
	
	function encodeDictionary(dictionary) {
		var string = 'd';
		
		for (var member in dictionary) {
			var key = member.length + ':' + member;
			var value = encode(dictionary[member]);
			
			string += key;
			string += value;
		}

		string += 'e';
		return string;
	}
	
	function encodeList(list) {
		var string = 'l';
		
		for (var index in list) {
			string += encode(list[index]);
		}
		
		string += 'e';
		
		return string;
	}
	
	function encodeString(string) {
		return string.length + ':' + string;
	}
	
	function encodeInteger(integer) {
		return 'i' + integer.toString() + 'e';
	}
	
	return output;
}

exports.encode = encode;

// decode a bencode string into javascript values.
exports.decode = function (data) {
	
	function getValue() {
		switch (true) {
			case data[0] == 'd': // dictionary
				return getDictionary();
			break;
			
			case data[0] == 'l': // list
				return getList();
			break;
			
			case !isNaN(data[0]): // Strings are stored as <length of string>:<string>:
				return getString();
			break;
			
			case data[0] == 'i': // Integers are stored as i<integer>e:
				return getInteger();
			break;
		}
	}
	
	function getDictionary() {
		var dictionary = {};
		
		data = data.substring(1); // remove 'd'
		while (data[0] != 'e') {
			var key = getString();
			var value = getValue();

			dictionary[key] = value;
		}
		data = data.substring(1); // remove 'e'
		
		return dictionary;
	}
	
	function getList() {
		var list = [];
		
		data = data.substring(1); // remove 'l'
		while (data[0] != 'e') {
			var value = getValue();;
			list.push(value);
		}
		data = data.substring(1); // remove 'e'
		
		return list;
	}
	
	function getString() {
		var end = data.indexOf(':');
		var length = data.substr(0, end);
			length = parseInt(length);
		
		var offset = end + 1;
		var value = data.substr(offset, length);
		
		data = data.substring(offset + length);
		
		return value;
	}
	
	function getInteger() {
		var end = data.indexOf('e');
		var integer = data.substring(1, end);
			integer = parseInt(integer);
		
		data = data.substring(end + 1); // remove up to 'e'
		
		return integer;
	}
	
	return getValue();
};