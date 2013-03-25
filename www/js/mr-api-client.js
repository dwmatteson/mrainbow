var mr_api = (function () {
	var	self = this,
		api_address = '//meetingrainbow.com/api/',
		websocket_address = 'ws://meetingrainbow.com:8181/';

	// development addresses, comment out for production
	api_address = '//localhost/api/';
	websocket_address = 'ws://localhost:8181/';

	self.socket = new WebSocket(websocket_address);
	self.socket.outputqueue = [];
	self.socket.queuelock = false;
	self.socket.token = '';

	self.userid = '';
	self.token = '';
	self.name = '';

	self.messagehandler = function (message) { console.log('websocket message unhandled: '+JSON.stringify(message)); }

	self.action = function (fields, cb) {
		console.log(JSON.stringify(fields));

		if(fields.password) { fields.password = md5(fields.password); }

		fields.userid = self.userid;
		fields.token = self.token;

		$.ajax({
			'url': api_address,
			'data': fields,
			'dataType': 'json',
		}).done(function (data) {
			console.log(JSON.stringify(data));

			if(!data || !data.status) {
				cb({ 'status':'error', 'message':'No response received from API.' });
				return;
			}

			if(fields.action === 'login' && data.status === 'success') {
				self.userid = data.id;
				self.token = data.token;
				self.name = data.name;

				// login to web socket as well on success
				self.socket.send(JSON.stringify(fields));
			}

			cb(data);
		});
	};

	self.socket.output  = function (message) {
		if(self.socket.queuelock) {
			while(self.socket.queuelock) {
				console.log('Waiting for queuelock...');
				window.setTimeout(function () { self.socket.output(message); }, 100);
				return;
			}
		}
		self.socket.outputqueue.push(JSON.stringify(message));
	};

	self.socket.intervalsend = function () {
		var i = 0;
		
		self.socket.queuelock = true;

		for(i in self.socket.outputqueue) {
			self.socket.send(self.socket.outputqueue[i]);
		}
		self.socket.outputqueue = [];

		self.socket.queuelock = false;

		setTimeout(self.socket.intervalsend, 1000);
	};

	self.socket.onmessage = function (data) {
		console.log(event.data); 
		var message = JSON.parse(event.data); 

		if(message.token) {
			self.socket.token = message.token;
		}

		self.messagehandler(message);
	};

	return self;
})();
