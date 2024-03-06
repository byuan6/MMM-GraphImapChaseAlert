var NodeHelper = require('node_helper');
var Imap = require('imap');
//const {simpleParser} = require('mailparser');

module.exports = NodeHelper.create({
	start: function () {
		console.log('MMM-GraphImapChaseAlert helper started...');
	},

	getFeed: function (config) {
//console.log(this.name + " getFeed() started");
		var self = this;
//console.log(config);

		var imap = new Imap({
			user: config.username,  
			password: config.password,
			host: config.imapAddress, //'imap.gmail.com',
			//servername: 'imap.gmail.com',  // SNI //https://github.com/nodejs/node/issues/28167
			port: config.imapPort, //993,
			tls: config.tls, //true,
			tlsOptions: config.tlsOptions, //{ servername: 'imap.gmail.com', }, //{ rejectUnauthorized: false } //https://stackoverflow.com/questions/59633564/cannot-connect-to-gmail-using-imap
		});
		
		var empty = {
			issued: null,
			author:{
				name: null,
			},
			title: null,
			text: null,
		};
		var all = {
			fullcount: 0,
			entry: [],
			title: config.username,
		};
		var firstday = new Date();
		if(firstday.getDate() <6)
			firstday = new Date(firstday.getFullYear(), ((firstday.getMonth()-2) % 12) +1, 1);  //.setDate(firstday.getDate()-1);
		else
			firstday = new Date(firstday.getFullYear(), firstday.getMonth(), 1);  //.setDate(firstday.getDate()-1);

//console.log(this.name + " imap.once()");
		var count=0;
		imap.once('ready', () => {
			imap.openBox('INBOX', false, () => {
				imap.search(['ALL', ['SINCE', firstday], ['FROM', 'no.reply.alerts@chase.com']], (err, results) => {
//console.log(self.name + " imap.search() callback");
					const f = imap.fetch(results, {bodies: ''});
					f.on('message', msg => {
						msg.on('body', stream => {
							const chunks = [];
							stream.on('data', (chunk) => {
								chunks.push(chunk.toString());
							});
							stream.on('end', () => {
								const output = chunks.join('');
//    console.log("stream to string");
//    console.log(output);
    								const text = self.deleteHtmlTags(output);
//    console.log(text);
								all.entry.push(text);
								all.fullcount = all.entry.length;

								var dataset = self.toDataset(all.entry);
								//dataset.sort((a,b) => (a.issued > b.issued) ? 1 : ((b.issued < a.issued) ? -1 : 0) );
								console.log(dataset);
								self.sendSocketNotification("MMM-GraphImapChaseAlert_JSON_RESULT", {username: config.username, data: dataset});		
							});
                                                });
/*
						msg.on('body', stream => {
console.log(self.name + " imap.on(body) callback");

//console.log(stream);
							simpleParser(stream, async (err, parsed) => {
//console.log(stream);
								console.log(self.name + " simpleParser callback " + count++);
								//console.log(parsed);
								var unread = {...empty};
								unread.issued = parsed.date;
								unread.author = {name: parsed.from.text};
								unread.title = parsed.subject;
								unread.text = parsed.text;
								unread.html = parsed.html;
console.log(unread);
								
								//console.log(unread);
								//console.log(parsed.from.text);
								//console.log(unread.author);
								all.entry.push(unread);
								all.fullcount = all.entry.length;
console.log("before sort")
								all.entry.sort((a,b) => (a.issued > b.issued) ? 1 : ((b.issued > a.issued) ? -1 : 0) );
console.log("before conversion");
								var dataset = self.toDataset(all.entry);
								//dataset.sort((a,b) => (a.issued > b.issued) ? 1 : ((b.issued < a.issued) ? -1 : 0) );
								console.log(dataset);
								self.sendSocketNotification("MMM-GraphImapChaseAlert_JSON_RESULT", {username: config.username, data: dataset});		
console.log("socket should have been send");
							});
						});

						/*
						msg.once('attributes', attrs => {
							const {uid} = attrs;
							imap.addFlags(uid, ['\\Seen'], () => {
								console.log('Marked as read!');
							});
						});
						*/
					});
					f.once('error', ex => {
						self.sendSocketNotification("MMM-GraphImapChaseAlert_JSON_ERROR", {username: config.username, error: ex });

						return Promise.reject(ex);
					});
					f.once('end', () => {
						console.log('Done fetching all messages! ' + all.entry.length);
						imap.end();
					});
				});
			});
		});
//console.log(this.name + " imap.connect()");
		imap.connect();
	},

	deleteHtmlTags: function(txt) {
		//const style1 = text.toLowerCase.indexOf("<style");
		//const style2 = text.toLowerCase.indexOf("</style>", Math.max(0,style1));
		var regex = /(<([^>]+)>)/ig;
		var regex2 =/(<([^>]+)>)\s*(<([^>]+)>)/ig;
		var parts = txt.split(/(<style|<\/style>)/);
//console.log(this.name + " part count " + parts.length)
//console.log(parts);;
		if(parts.length==5) {
			parts[1]="";
			parts[2]="";
			parts[3]="";
			var combined = parts.join("");
			return combined.replace(regex2, " ").replace(regex, "");
		}
		return txt.replace(regex2, " ").replace(regex, "");
	},

	toDataset: function (msglist) {
//console.log(this.name + " toDataset");
		/*
		const regexpDate = /Account summary for (.+, [JFMASOND][aepuc][nbrylgptvc] [1-3]*[0-9]+, 20[0-9][0-9])/;
		const regexpHeader = /(Account ending in \(\.\.\.[0-9][0-9][0-9][0-9]\))/;
		const regexpBalance = /End of Day Balance \$([,0-9]+.[0-9][0-9])/;
		const regexpDeposit = /Total Deposits \$([,0-9]+.[0-9][0-9])/;
		const regexpWithdrawal = /Total Withdrawals \$([,0-9]+.[0-9][0-9])/;
		*/
		//const regexpHttpHeaderWithDate = /\S+: .*((Sun|Mon|Tue|Wed|Thu|Fri|Sat), [0-3]?[0-9] (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) 2[0-4][0-9][0-9] [0-2][0-9]:[0-5][0-9]:[0-9][0-9] [-+][0-9][0-9][0-9][0-9]).*/;

		const regexpDate = new RegExp(this.config.extractDateRegEx);
		const regexpHeader = new RegExp(this.config.extractHeaderRegEx);
		const regexpBalance = new RegExp(this.config.extractBalanceRegEx);
		const regexpDeposit = new RegExp(this.config.extractDepositRegEx);
		const regexpWithdrawal = new RegExp(this.config.extractWithdrawalRegEx);

		var data = [];
		const len = msglist.length;
//console.log(this.name + " texts " + len);
		for(var i = 0; i<len; i++) {
			// const msg = msglist[i];
			// const txt = msg.text;
			const txt = msglist[i];
			var item = { msgdate: null, afterdate: null, header: null, balance:null, deposit:null, withdrawal:null };
//console.log("Looping thru message");
//console.log(i);
//console.log(txt);
			// Received: by 2002:a5b:bd2:0:b0:dbf:3be0:95a0 with SMTP id c18csp73897ybr; Thu, 1 Feb 2024 04:34:08 -0800 (PST)
			// X-Received: by 2002:ad4:4ea6:0:b0:686:2520:694c with SMTP id ed6-20020ad44ea6000000b006862520694cmr5694769qvb.36.1706790848349; Thu, 01 Feb 2024 04:34:08 -0800 (PST).*
			// Date: Thu, 1 Feb 2024 07:34:06 -0500 (EST)
			const regexHttpdate = /(Sun|Mon|Tue|Wed|Thu|Fri|Sat)?, [0-3]?[0-9] (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)? 2[0-4][0-9][0-9] [0-2][0-9]:[0-5][0-9]:[0-9][0-9] [-+][0-9][0-9][0-9][0-9]/;
//			const httpheadermatchall = txt.matchAll(/^\S+:.+$/);
			var messageparts = txt.split("From: ");
			var headerparts = messageparts[0].split("\n");
			var headercount = headerparts.length;
			for (var h=0; h<headercount; h++) {
//console.log("header"+h+ " " + headerparts[h]);
				const name=headerparts[h];
				if(name.indexOf("Date")>=0 || name.indexOf("Received")>=0) {
//console.log("Date in header name detected");
					const httpdatematch = name.match(regexHttpdate);
					if (httpdatematch) {
//console.log("Date format found:");
//console.log(httpdatematch);
						if('0' in httpdatematch) {
							const d=new Date(httpdatematch[0]);
//console.log("converted date")
//console.log(d);
							item.msgdate = item.msgdate ? Math.min(d, item.msgdate): d;
//console.log("new message date:");
//console.log(item);
						}
//console.log("end of httpdatematch true");
					}
				}
			}

			const afterdatematch = txt.match(regexpDate);
			item.afterdate = '1' in afterdatematch ? afterdatematch[1] : null;
			const headermatch = txt.match(regexpHeader);
			item.header = '1' in headermatch ? headermatch[1] : null;
			const balancematch = txt.match(regexpBalance);
			item.balance = '1' in balancematch ? parseFloat(balancematch[1].replace(",","")) : null;
			const depositmatch = txt.match(regexpDeposit);
			item.deposit = '1' in depositmatch ? parseFloat(depositmatch[1].replace(",","")) : null;
			const withdrawalmatch = txt.match(regexpWithdrawal);
			item.withdrawal = '1' in withdrawalmatch ? parseFloat(withdrawalmatch[1].replace(",","")) : null;
//console.log(afterdatematch);
//console.log(headermatch);
//console.log(balancematch);
//console.log(afterdatematch);

			data.push(item);
		}
		return data;
	},

	//Subclass socketNotificationReceived received.
	socketNotificationReceived: function (notification, config) {
		console.log(this.name + ' Received ' + notification);
		if (notification === "MMM-GraphImapChaseAlert_GET_JSON") {
			this.config = config;
			this.getFeed(config);
		}
	}
});


