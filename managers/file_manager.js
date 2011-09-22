var U = require('U');
var File = require('./../file');

exports.create = function (torrent, callback) {
	
	var instance = {};
	
	function createFiles () {
		var pieceLength = torrent.infomation.info['piece length'];
		var pieceManager = torrent.pieceManager;
		var files = [];
		
		// http://fileformats.wikia.com/wiki/Torrent_file
		if (typeof torrent.infomation.info.length != 'undefined') { // single file format;
			console.log(torrent.infomation.info.length);
		}
		else if (typeof torrent.infomation.info.files != 'undefined') { // multi file format;
			var fileDescriptions = torrent.infomation.info.files;
			var fileOffset = 0;
			
			fileDescriptions.forEach(function (description) {
				var path = description.path.join('/');
				var endOffset = fileOffset + description.length;
				var startIndex = Math.floor(fileOffset / pieceLength);
				var endIndex = Math.floor(endOffset / pieceLength);
				var pieces = [];

				for (var index = startIndex; index <= endIndex; index++) {
					pieces.push(pieceManager.pieces[index]);
				}

				var file = new File(path, description.length, pieces);
				files.push(file);
				fileOffset += description.length;
			});
		}

		return files;
	}

	instance.files = createFiles();

	callback(null, instance);
};