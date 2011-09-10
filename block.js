module.exports = function block (offset, size) {
	
	var instance = {};
		instance.offset = offset;
		instance.size = size;
		instance.data = null;
		
	return instance;
};