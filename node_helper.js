var NodeHelper = require('node_helper');
var Imap = require('imap');
const {simpleParser} = require('mailparser');

module.exports = NodeHelper.create({
	start: function () {
		console.log('MMM-GraphImapChaseAlert helper started...');
	},

	getFeed: function (config) {
		var self = this;

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
		if(firstday.getDate() <5)
			firstday = new Date(firstday.getFullYear(), ((firstday.getMonth()-2) % 12) +1, 1);  //.setDate(firstday.getDate()-1);
		else
			firstday = new Date(firstday.getFullYear(), firstday.getMonth(), 1);  //.setDate(firstday.getDate()-1);

		var count=0;
		imap.once('ready', () => {
			imap.openBox('INBOX', false, () => {
				imap.search(['ALL', ['SINCE', firstday], ['FROM', 'no.reply.alerts@chase.com']], (err, results) => {
					const f = imap.fetch(results, {bodies: ''});
					f.on('message', msg => {
						msg.on('body', stream => {
							simpleParser(stream, async (err, parsed) => {
								console.log(count++);
								//console.log(parsed);
								var unread = {...empty};
								unread.issued = parsed.date;
								unread.author = {name: parsed.from.text};
								unread.title = parsed.subject;
								unread.text = parsed.text;
								unread.html = parsed.html;
								
								//console.log(unread);
								//console.log(parsed.from.text);
								//console.log(unread.author);
								all.entry.push(unread);
								all.fullcount = all.entry.length;

								all.entry.sort((a,b) => (a.issued > b.issued) ? 1 : ((b.issued > a.issued) ? -1 : 0) );
								var dataset = self.toDataset(all.entry);
								//dataset.sort((a,b) => (a.issued > b.issued) ? 1 : ((b.issued < a.issued) ? -1 : 0) );
								console.log(dataset);
								self.sendSocketNotification("MMM-GraphImapChaseAlert_JSON_RESULT", {username: config.username, data: dataset});		
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
		imap.connect();
	},

	toDataset: function (msglist) {
		/*
		const regexpDate = /Account summary for (.+, [JFMASOND][aepuc][nbrylgptvc] [1-3]*[0-9]+, 20[0-9][0-9])/;
		const regexpHeader = /(Account ending in \(\.\.\.[0-9][0-9][0-9][0-9]\))/;
		const regexpBalance = /End of Day Balance \$([,0-9]+.[0-9][0-9])/;
		const regexpDeposit = /Total Deposits \$([,0-9]+.[0-9][0-9])/;
		const regexpWithdrawal = /Total Withdrawals \$([,0-9]+.[0-9][0-9])/;
		*/
		const regexpDate = new RegExp(this.config.extractDateRegEx);
		const regexpHeader = new RegExp(this.config.extractHeaderRegEx);
		const regexpBalance = new RegExp(this.config.extractBalanceRegEx);
		const regexpDeposit = new RegExp(this.config.extractDepositRegEx);
		const regexpWithdrawal = new RegExp(this.config.extractWithdrawalRegEx);

		var data = [];
		const len = msglist.length;
		for(var i = 0; i<len; i++) {
			const msg = msglist[i];
			const txt = msg.text;
			var item = { msgdate: msg.issued, afterdate: null, header: null, balance:null, deposit:null, withdrawal:null };

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


