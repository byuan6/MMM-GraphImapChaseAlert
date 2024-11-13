'use strict';

Module.register("MMM-GraphImapChaseAlert", {

	mailCount: 0,
	jsonData: null,
	errorData: null,

	// Default module config.
	defaults: {
		width: "375px",
		height: "300px",
		style: 'border:0;-webkit-filter: grayscale(100%);filter: grayscale(100%);',

		// the string here are escaped twice, once to create string liternal, and then the string literal has to have escape sequnce to regex
		extractDateRegEx: "Account summary for (.+, [JFMASOND][aeopuc][nbrylgptvc] [1-3]*[0-9]+, 20[0-9][0-9])",
		extractHeaderRegEx: "(Account ending in \\(\\.\\.\\.[0-9][0-9][0-9][0-9]\\))",
		extractBalanceRegEx: "End of Day Balance \\$(-?[,0-9]+.[0-9][0-9])",
		extractDepositRegEx: "Total Deposits \\$([,0-9]+.[0-9][0-9])",
		extractWithdrawalRegEx: "Total Withdrawals \\$([,0-9]+.[0-9][0-9])",

		updateTime: ["1995-12-17T04:00:00"],
		maxDays: 0, //5

		imapAddress: 'imap.gmail.com',
		imapPort: 993,
		tls: true,
		tlsOptions: { servername: 'imap.gmail.com', },

		username: "yourname@gmail.com",
		password: "https://support.google.com/mail/answer/185833?hl=en",
	},

	start: function () {
		this.updateDom(500);

		this.getJson();
		this.scheduleUpdate();
	},

	scheduleUpdate: function () {
		var self = this;
		const config = this.config;
		const schedule = (typeof config.updateTime) == "string" ? [config.updateTime] : config.updateTime;
		const len = schedule.length;
		for(var i=0; i<len; i++) {
			const dt = new Date(schedule[i]);
			const now = new Date();
			dt.setFullYear(now.getFullYear(),now.getMonth(), now.getDate());
			var diff = dt.getTime() - now.getTime(); //time until scheduled time
			if(diff<0) //if in past, add 1 day
				diff += 24*60*60*1000; //1day
			
			console.log(this.name + " update scheduled");
			//console.log(dt);
			console.log(new Date(now.getTime()+diff));
			setTimeout(function(){
				setInterval(function () {
					self.getJson();
				}, 24*60*60*1000);	//1day
			}, diff);
		}
	},

	// Define required scripts.
	getStyles: function () {
		return ["Chart.min.css"];
	},

	// Define required scripts.
	getScripts: function() {
		return ["Chart.min.js"];
	},

	// Request node_helper to get json from url
	getJson: function () {
		console.log("MMM-GraphImapChaseAlert_GET_JSON");
		this.sendSocketNotification("MMM-GraphImapChaseAlert_GET_JSON", this.config);
	},

	socketNotificationReceived: function (notification, payload) {
		var self=this;
		if (notification === "MMM-GraphImapChaseAlert_JSON_RESULT") {
			this.jsonData = payload;
			//this.errorData = null;
			console.log(payload);
			const data = payload.data;

			this.x1 = data.map((s) => s.afterdate);
			this.x2 = data.map((s) => s.msgdate);
			this.y1 = data.map((s) => s.balance);
			//this.y2 = data.map((s) => s.withdrawal);
			this.y3 = data.map((s) => s.deposit);
			this.y4 = new Array(data.length);
			const last = data.length-1;
			this.y4[last] = this.y1[last];

			const chart1 = window.chart1; //this.chart;
            chart1.data.labels = this.x1;
            chart1.data.x = this.x2; //not documented, but added ad-hoc
			chart1.data.datasets[0].data = this.y1;
			//chart1.data.datasets[1].data = this.y2;
			chart1.data.datasets[1].data = this.y3;
			chart1.data.datasets[2].data = this.y4;

			chart1.update();

			console.log("last balance");
			console.log(this.y1[this.y1.length-1]);
			console.log(self.balance);
			const USDollar = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: 'USD',
			});
			document.all.balancediv.innerHTML = "(Last)" + USDollar.format(Math.round(this.y1[this.y1.length-1]));

			
			if(!this.timeout)
				this.timeout = setTimeout(function(){
					self.timeout = null;
					if(self.x1.length < 4)
						return; //abort bc needs data

					// get data in graph
					const x = self.x1.map((s) => Date.parse(s));
					const y = self.y1
					console.log(x);
					console.log(y);
					// divide data in only deceasing segments
					const sets = self.getDatasets(x,y);
					console.log(sets);
					// create a model of rate of decrease
					var model = null;
					for(var i=0; i<sets.length; i++){
						const data = sets[i];
						let trial = self.getRegression(data.x, data.y);
						if(model==null) {
							model = trial;
							model.m = trial.m * trial.n;
							model.b = trial.b * trial.n;
						} else {
							model.n+=trial.n;
							model.m+=trial.m * trial.n;
							model.b+=trial.b * trial.n;
							model.maxX=Math.max(model.maxX,trial.maxX);
							model.minX=Math.min(model.minX,trial.minX);
						}
					}
					console.log(model);
					if(model.n < 4)
						return; //abort bc projection needs adequate data
					// average the models together
					model.m /= model.n;
					model.b /= model.n;
					model.n /= model.n;
					model.maxX = Math.max(...x);
					console.log(model);
					
					//create a projection of balance decline on each workday, until next month
					const day_in_ms = 24*60*60*1000;
					var lastday = new Date(Math.max(...x));
					lastday.setMonth(lastday.getMonth()+1);
					lastday.setDate(1);
					console.log(model.b);
					console.log(x[x.length-1]);
					console.log("----");
					console.log("projected at last point");
					console.log((model.m*x[x.length-1]+model.b));
					console.log("actual at last point");
					console.log(y[y.length-1]);
					console.log("differece, actual - projected");
					const delta = y[y.length-1]- (model.m*x[x.length-1]+model.b)
					console.log(delta);
					model.b += delta;
					console.log("changed intercept");
					console.log(model.b);
					console.log("new projected at last point");
					console.log((model.m*x[x.length-1]+model.b));
					var projection = self.getProjection(model, lastday.getTime(), day_in_ms, (s)=>(new Date(s)).getDay()==0 || (new Date(s)).getDay()==6);
					console.log(projection);
					if(projection.x.length>0) {
						// add projection to chart, and update
						const chart1 = window.chart1; //this.chart;
						chart1.data.labels = self.x1.concat(projection.x.map((s) => (new Date(s)).toDateString()));
						//chart1.data.x = data.map((s) => s.msgdate); //not documented, but added ad-hoc
						//chart1.data.datasets[0].data = data.map((s) => s.balance);
						//chart1.data.datasets[1].data = data.map((s) => s.withdrawal);
						//chart1.data.datasets[2].data = data.map((s) => s.deposit);
						chart1.data.datasets[2].data = self.y4.concat(projection.y);
		
						//const last = data.length-1;
						//chart1.data.datasets[3].data[last] = chart1.data.datasets[0].data[last];
		
						chart1.update();
		
						// create a 
						const USDollar = new Intl.NumberFormat('en-US', {
							style: 'currency',
							currency: 'USD',
						});
						console.log(y[y.length-1]);
						console.log(projection.y[projection.y.length-1]); 
						document.all.balancediv.innerHTML = "(Last)" + USDollar.format(y[y.length-1]) + "<br>(Est "+ (lastday.getMonth()+1) +"/"+ lastday.getDate() +")" + USDollar.format(Math.round(projection.y[projection.y.length-1]));
						console.log(self.balance);
						//console.log(self.innerHTML);
					} else {
						document.all.balancediv.innerHTML = "(Last)" + USDollar.format(y[y.length-1]) + "<br>(End of Month)";
					}
				}, 15000);
		}
		if (notification === "MMM-GraphImapChaseAlert_JSON_ERROR") {
			if(payload.username === this.config.username) {
				//this.jsonData = null;
				this.errorData = "Error: [" + payload.error + "]";
				this.updateDom(500);
			}
		}
	},

	getDatasets: function(xArray,yArray) {
		var results = [];
		var dataset = {x:[],y:[]};
		const len = xArray.length;
		for(var i=0; i<len; i++) {
			if(i!=0 && yArray[i]>yArray[i-1]) {
				if(dataset.y.length>3)
					results.push(dataset);
				dataset = {x:[],y:[]};
			}
			dataset.x.push(xArray[i]);
			dataset.y.push(yArray[i]);
		}
		if(dataset.y.length>3)
			results.push(dataset);
		return results;
	},

	// https://www.w3schools.com/ai/ai_regressions.asp
	getRegression: function(xArray,yArray) {
		//const xArray = [50,60,70,80,90,100,110,120,130,140,150];
		//const yArray = [7,8,8,9,9,9,10,11,14,14,15];
		console.log(xArray);
		console.log(yArray);

		// Calculate Sums
		let xSum=0, ySum=0 , xxSum=0, xySum=0;
		let count = xArray.length;
		for (let i = 0, len = count; i < count; i++) {
			xSum += xArray[i];
			ySum += yArray[i];
			xxSum += xArray[i] * xArray[i];
			xySum += xArray[i] * yArray[i];
		}

		// Calculate slope and intercept
		let slope = (count * xySum - xSum * ySum) / (count * xxSum - xSum * xSum);
		let intercept = (ySum / count) - (slope * xSum) / count;

		return {m: slope, b:intercept, n:count, maxX:Math.max(...xArray), minX:Math.min(...xArray)};

		/*
		// Generate values
		var i=Math.max(...xArray);
		console.log(new Date(i+step));
		console.log(new Date(extra));

		const xValues = [];
		const yValues = [];
		for (let x = i+step; x < extra; x += step) {
			xValues.push(x);
			yValues.push(x * slope + intercept);
		}

		return {m: slope, b:intercept, x:xValues, y:yValues};
		*/
	},

	getProjection: function(equation,extra,step, filter) {
		const slope = equation.m;
		const intercept = equation.b;
		// Generate values
		var i = equation.maxX;
		console.log(new Date(i+step));
		console.log(new Date(extra));

		const xValues = [];
		const yValues = [];
		for (let x = i+step; x < extra; x += step) {
			if(filter)
				if(filter(x,x * slope + intercept))
					continue;
			xValues.push(x);
			yValues.push(x * slope + intercept);
			console.log(new Date(x));
			console.log(x * slope + intercept);
		}

		return {m: slope, b:intercept, x:xValues, y:yValues};
	},


	// Override getHeader method.
	//getHeader: function() {
	//	if (!this.jsonData) {
	//		return "ImapFeed";
	//	}
	//	if (this.config.playSound && this.jsonData.fullcount > this.mailCount) {
	//		new Audio(this.file("eventually.mp3")).play();
	//	}
	//	this.mailCount = this.jsonData.fullcount;
	//	return this.jsonData.title + "  -  " + this.jsonData.fullcount;
	//},

	// Override dom generator.
	getDom: function () {
		const config = this.config;
		console.log(this.config);

		var div = document.createElement("div");
		div.style = config.style;
		div.style.width = config.width;
		div.style.height = config.height;
		div.style.maxHeight = config.height;
		var canvas = document.createElement("canvas");
		canvas.id = "chart-1";
		canvas.style.width = config.width;
		canvas.style.height = config.height;
		canvas.style.maxHeight = config.height;
		this.chart = canvas;
		div.append(canvas);

		var script = document.createElement("script");
		script.innerHTML = `
		window.chartColors = {
			white: 'rgb(255, 255, 255)',
			black: 'rgb(0, 0, 0)',
			red: 'rgb(255, 99, 132)',
			orange: 'rgb(255, 159, 64)',
			yellow: 'rgb(255, 205, 86)',
			green: 'rgb(75, 192, 192)',
			blue: 'rgb(54, 162, 235)',
			purple: 'rgb(153, 102, 255)',
			grey: 'rgb(201, 203, 207)',
			aqua: 'rgb(0, 255, 255)',
			teal: 'rgb(0, 128, 128)',
			maroon: 'rgb(128, 0, 0)',
			olive: 'rgb(128, 128, 0)',
			lime: 'rgb(0, 255, 0)',
			fushia: 'rgb(128, 0, 128)',
			navy: 'rgb(0, 0, 128)',
			pink: 'rgb(255, 192, 203)',
			saddlebrown: 'rgb(139, 69, 19)'
		};
		var presets = window.chartColors;

		function transparentize(color, opacity) {
			var alpha = opacity === undefined ? 0.5 : 1 - opacity;
			return window.Color(color).alpha(alpha).rgbString();
		}

		var ampdata = {
			labels: [],
			datasets: [{
				backgroundColor: window.Color(window.chartColors.white).alpha(0.4).rgbString(), //transparentize(presets.blue),
				borderColor: presets.white,
                                borderWidth: 1,
                                pointRadius: 1,
				data: [],
				label: 'Balance',
				fill: 'origin'
			}, /*{
				backgroundColor: window.chartColors.maroon, //transparentize(presets.red),
				borderColor: presets.maroon,
                                borderWidth: 1,
                                pointRadius: 1,
				data: [],
				label: 'Withdrawal',
				fill: 'origin'
			},*/ {
				type:'bar',
				backgroundColor: window.chartColors.lime,
				borderColor: presets.lime,
				width:'100%',
				barPercentage:1.25,
				data: [],
				label: 'Deposit',
				fill: '-1'
			}, {
				backgroundColor: window.Color(window.chartColors.white).alpha(0.1).rgbString(), //transparentize(presets.red),
				borderColor: presets.white,
                                borderWidth: 1,
                                pointRadius: 1,
				data: [],
				label: 'Projected',
				fill: '-1'
			}]
		};

		var options = {
			maintainAspectRatio: false,
			spanGaps: false,
			elements: {
				line: {
					tension: 0.1
				}
			},
			scales: {
				yAxes: [{
                    position: 'right',
					stacked: false
				}]
			}
		};

		var chart1 = new Chart('chart-1', {
			type: 'line',
			legend: {
				itemWrap: false,     // Change to true or false 
			},
			data: ampdata,
			options: options
		});
		`;
		div.append(script);
		//div.append(document.createTextNode("INitialllzing"));
		
		var div2 = document.createElement("div");
		div2.className="thin medium bright";
		div2.id="balancediv";
		div2.style.maxWidth = config.width;
		div2.style.top = "40px";
		div2.style.textAlign = "right";
		//div2.style.left = 0;
		div2.style.position = "absolute";
		div2.style.backgroundColor = "rgba(255,255,255,0.1)";
		div2.innerHTML = "N/A";
		div.appendChild(div2);
		this.balance = div2;

		return div;
	},


});
