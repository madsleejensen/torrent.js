// prevent root access.
process.setgid(20);
process.setuid(501);

if (process.argv[2]) {
	var module = require('./' + process.argv[2]);
}

setInterval(function () {
	var usage = process.memoryUsage();
	console.log('memory: [vsize: %d kb] [rss: %d kb] [heap-total: %d kb] [heap-used: %d kb]', Math.round(usage['vsize'] / 1024), Math.round(usage['rss'] / 1024), Math.round(usage['heapTotal'] / 1024), Math.round(usage['heapUsed'] / 1024));
}, 2000);