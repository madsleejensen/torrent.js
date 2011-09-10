var Url = require('url');
var HttpTracker = require('./trackers/http');

exports.create = function (uri) {
	var info = Url.parse(uri);
 
	switch (info.protocol) {
		case 'http:':
			return HttpTracker(info);
		break;

		case 'udp:':
			return null;
		break;
		
		default: 
			return null;
		break;
	}
};