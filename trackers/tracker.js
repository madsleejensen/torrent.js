var Url = require('url');
var HttpTracker = require('./http');
var UDPTracker = require('./udp');

exports.create = function (uri) {
	var info = Url.parse(uri);
 
	switch (info.protocol) {
		case 'http:':
			return HttpTracker.create(info);
		break;

		case 'udp:':
			return UDPTracker.create(info);
		break;
		
		default: 
			return null;
		break;
	}
};