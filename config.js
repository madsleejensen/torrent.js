module.exports = {
	PIECE_HASH_BYTE_LENGTH: 20,
	
	Tracker: {
		MAXIMUM_FAILED_ATTEMPTS: 3,
		LISTENING_PORT: 8111,
		UDP_REQUEST_TIMEOUT: 5000
	},
	
	MAXIMUM_ACTIVE_PEERS: -1, // -1 == unlimited
	MAXIMUM_CONNECTING_PEERS: 150,
	MAXIMUM_CONNECTION_ATTEMPTS: 2,
	SECONDS_BETWEEN_CONNECTION_ATTEMPTS: 5,

	Blocks: {
		MAXIMUM_ASSIGNED_PEERS: 5
	},
	Downloader: {
		DOWNLOAD_ITEMS_LOOK_AHEAD: 5 // How many download items the downloader should find peers for.
	},
	Peer: {
		CONNECTION_TIMEOUT: 5000,
		MAXIMUM_PIECE_CHUNK_REQUESTS: 8, // number of chunk requests pr. peer. (http://wiki.theory.org/Talk:BitTorrentSpecification#Algorithms:_Queuing)
		REQUEST_TIMEOUT: 3500 // timeout on request sent by the peer.
	}
};