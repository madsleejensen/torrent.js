var U = require('U');
var File = require('./../file');

exports.create = function (torrent, callback) {
	
	var instance = {};
	
	function createFiles () {
		var pieceLength = torrent.infomation.info['piece length'];
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
				var fileEndOffset = fileOffset + description.length;
				var startIndex = Math.floor(fileOffset / pieceLength);
				var endIndex = Math.floor(fileEndOffset / pieceLength);

				var startOffset = fileOffset - (startIndex * pieceLength); // how many bytes to skip in the first piece.
				var endOffset = fileEndOffset - (endIndex * pieceLength); // the end byte position of the piece.

				var requirements = [];

				for (var index = startIndex; index <= endIndex; index++) {
					var requirement = {
						piece: torrent.pieceManager.pieces[index]
					};

					// NÆSTE SKRIDT FÅ DEN TIL KUN AT HENTE BLOCKS DER ER REQUIRED.
					var offset = {
						start: null, 
						end: null
					};

					if (index === startIndex) {
						offset.start = startOffset;
					}
					if (index === endIndex) {
						offset.end = endOffset;
					}

					requirement.offset = offset;
					requirements.push(requirement);
				}

				var file = new File(torrent, path, description.length, requirements);
				files.push(file);
				fileOffset += description.length;
			});
		}

		return files;
	}

	instance.files = createFiles();

	callback(null, instance);
};