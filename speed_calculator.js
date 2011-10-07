var COLLECT_SAMPLE_INTERVAL = 1000; // 
var CALCULATE_AVARAGE_INTERVAL = 2000;

module.exports = function SpeedCalculator () {
	var instance = {};
	instance.avarageSpeed = 0; // avarage bytes / second.
	instance.bytesSinceLastSample = 0;
	instance.samples = [];

	var mSampleInterval;
	var mAvarageCalculatorInterval;

	instance.addBytes = function (bytes) {
		instance.bytesSinceLastSample += bytes;
	};

	instance.destroy = function () {
		if (mSampleInterval) {
			clearInterval(mSampleInterval);
			mSampleInterval = null;
		}

		if (mAvarageCalculatorInterval) {
			clearInterval(mAvarageCalculatorInterval);
			mAvarageCalculatorInterval = null;
		}
	};

	function collectSample () {
		if (instance.samples.length > 5) {
			instance.samples.shift();	
		}

		instance.samples.push(instance.bytesSinceLastSample);
		instance.bytesSinceLastSample = 0;
	}

	function calculateAvarage () {
		var sum = 0;
		for (var i = 0; i < instance.samples.length; i++) {
			sum += instance.samples[i];	
		}

		var secondRatio = 1000 / COLLECT_SAMPLE_INTERVAL;
		var avaragePerSecond = sum * secondRatio;
		instance.avarageSpeed = avaragePerSecond;
	}

	mSampleInterval = setInterval (collectSample, COLLECT_SAMPLE_INTERVAL);
	mAvarageCalculatorInterval = setInterval (calculateAvarage, CALCULATE_AVARAGE_INTERVAL);

	return instance;
};