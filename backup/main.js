// http://wiki.theory.org/BitTorrentSpecification#Peer_wire_protocol_.28TCP.29
var net = require('net');

// handshake: <pstrlen><pstr><reserved><info_hash><peer_id>
function handShake(id, hash, peerId) {

	var size = 1; // 1 byte marking the length of the ID.
		size += id.length;
		size += 8; // reserved bytes.
		size += hash.length;
		size += peerId.length;

	var offset = 0;
	var buffer = new Buffer(size);
	buffer.writeInt8(id.length, 0, 'big'); // <pstrlen>
	offset += 1; 
	buffer.write(id, offset, id.length, 'binary'); // <pstr>
	offset += 8; // <reserved> 
	offset += id.length;
	buffer.write(hash, offset, hash.length, 'binary'); // <info_hash>
	offset += hash.length;
	buffer.write(peerId, offset, peerId.length, 'binary'); // <peer_id>

	return buffer;
}

var messages = {
	choke: 0, // <len=0001><id=0>
	unchoke: 1, // <len=0001><id=1>
	interested: 2, // <len=0001><id=2>
	not_interested: 3, // <len=0001><id=3>
	have: 4, // <len=0005><id=4><piece index>
	bitfield: 5, // <len=0001+X><id=5><bitfield>
	request: 6, // <len=0013><id=6><index><begin><length>
	piece: 7, // <len=0009+X><id=7><index><begin><block>
	cancel: 8, // <len=0013><id=8><index><begin><length>
	port: 9	// <len=0003><id=9><listen-port>
};

// <length prefix><message ID><payload>
function message(buffer) {
	var length = buffer.readInt32(0, 'big'); // 4 bytes.
	var messageId = buffer.readInt8(4, 'big'); // 1 byte
	var payload = buffer.slice(5); // rest of message is the payload.
		
	return {
		length: length,
		messageId: messageId,
		payload: payload	
	};
}

function handle(message) {
	
	switch (message.messageId) {

		case messages.choke:
		break;

		case messages.unchoke:
		break;

		case messages.interested:
		break;

		case messages.not_interested:
		break;

		case messages.have:
		break;

		case messages.bitfield:
		break;

		case messages.request:
		break;
		
		case messages.piece:
		break;

		case messages.cancel:
		break;

		case messages.port:
		break;

	}
};