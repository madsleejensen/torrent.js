var Events = require ('events');

module.exports = function (torrent, path, length, requirements) {
	var instance = new Events.EventEmitter();
	instance.path = path;
	instance.length = length;
	instance.requirements = requirements;
	instance.completed = false;

	/*
	instance.download = function () {
		torrent.download(instance);
		setInterval(onPieceCompleted, 2000);
	};

	function onPieceCompleted (piece) {
		if (instance.completed) {
			return;
		}

		for (var i = (instance.requirements.length - 1); i >= 0; i--) {
			var requirement = instance.requirements[i];
			
			if (!requirement.piece.completed) {
				// because some pieces does not need to be fully downloaded to complete a file we check the required blocks from the incompleted piece
				if (requirement.offset !== null) {
					var blocks = requirement.piece.blocks.getByRange(requirement.offset);
					for (var x = 0; x < blocks.length; x++) {
						var block = blocks[x];
						if (!block.completed) {
							console.log('file missing [index: %d] [block: %d]', requirement.piece.index, block.chunk);
							return; // not completed
						}
					}
				}
				else {
					console.log('file missing [index: %d]', requirement.piece.index);
					return; // not completed
				}
			}	
		}

		console.log("FILE COMPLETEDDDDDDD");
		// all pieces completed file completed.
		instance.completed = true;
		torrent.pieceManager.removeListener('piece:completed', onPieceCompleted);
		instance.emit('file:completed', instance);
	};
	*/
	//torrent.pieceManager.on('piece:completed', onPieceCompleted);

	return instance;
};