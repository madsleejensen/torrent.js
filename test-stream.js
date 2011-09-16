var stream = require("stream");


var mads = function () {
	this.writeable = true;
};
mads.prototype = new stream.Stream();
mads.prototype.write = function (chunk) {
	this.emit("data", chunk);	
};


var test = new mads();
test.on("data", function () {
	console.log(arguments);
});
test.write("123");

test.on('data', function() {
	console.log(arguments);
});

test.write("OK");