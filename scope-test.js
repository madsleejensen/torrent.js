var data = [
	{value: 1},
	{value: 2},
	{value: 3}
];

for (var i in data) {
	var item = data[i];

	(function scope() {
		var test = {
			item: item,
			timeout: setTimeout(function() {
				console.log(test.item.value);
			}, 1000)
		};	
	})();
}
