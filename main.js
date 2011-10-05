// prevent root access.
process.setgid(20);
process.setuid(501);

if (process.argv[2]) {
	var module = require('./' + process.argv[2]);
}