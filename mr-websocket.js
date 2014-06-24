// mr-webws.js : Meeting Rainbow Web ws Process
// Author : Dave Matteson

var	MRAPI = require('./mr-api.js'),
	mr_api = MRAPI.create({
	        'mysql_server' : 'localhost',
	        'mysql_username' : 'mrainbow',
	        'mysql_password' : 'pVal!mdx8Q-D#',
	        'mysql_database' : 'mrainbow'
	}),
	WebwsServer = require('ws').Server,
	wss = new WebwsServer({ port: 8181 });

var	socketcount = 0;

var viewers = (function () {
	var	self = this,
		meetings = {};

	self.pushUpdate = function (fields) {
		var	i = 0;

		//console.log('meetings = '+JSON.stringify(meetings)+',\nfields = '+JSON.stringify(fields));

		if(!meetings[fields.meetingid]) { return false; }

		for(i in meetings[fields.meetingid]) {
			// Don't send to self
			if(meetings[fields.meetingid][i].socket.id === fields.socketid) { 
				console.log('Sockets match with id = '+fields.scoketid+' and id = '+meetings[fields.meetingid][i].socket.id);
				continue; 
			}
			if(meetings[fields.meetingid][i].socket.output === undefined) { 
				console.log('No output method found for connection with userid = '+meeting[fields.meetingid[i]].userid);
				continue; 
			}

			console.log('Pushing update to userid = '+meetings[fields.meetingid][i].userid+' socketid = '+meetings[fields.meetingid][i].socket.id);
			meetings[fields.meetingid][i].socket.output(fields.message);
		}
	};

	self.addViewer = function (fields) {
		if(!fields.meetingid) { return false; }

		if(meetings[fields.meetingid] === undefined) {
			meetings[fields.meetingid] = [];
		}

		meetings[fields.meetingid].push({
			'userid'	: fields.userid,
			'socket'	: fields.socket
		});

		return true;
	};

	self.removeViewer = function (fields) {
		var i = 0;

		if(!meetings[fields.meetingid]) { return false; }

		for(i in meetings[fields.meetingid]) {
			if(meetings[fields.meetingid][i].userid === fields.userid) {
				delete meetings[fields.meetingid][i];
				return true;
			}
		}

		return false;
	};

	return self;

})();

wss.on('connection', function (ws) {
	var	self = this;

	ws.userid = '';
	ws.token = '';
	ws.meetingid = '';
	ws.id = socketcount;
	++socketcount;

	ws.output = function (message) {
		console.log('output = '+JSON.stringify(message));
		ws.send(JSON.stringify(message), function (error) {
			if(error) {
				console.log('Error sending to user, removing from viewers.');
				viewers.removeViewer({
					'userid'	: ws.userid,
					'meetingid'	: ws.meetingid
				});
			}
		});
	};

	ws.on('message', function (message) {
		console.log('message = '+message);
		message = JSON.parse(message);

		switch(message.action) {
			case 'login':
				mr_api.login({
					'email'		: message.email,
					'password'	: message.password
				}, function (data) {
					if(data.status === 'success') {
						ws.userid = data.id;
						ws.token = data.token;
					}

					data.callback_id = message.callback_id;
					ws.output(data);
				});
				return;
			case 'reestablish':
				ws.userid = message.userid;
				ws.token = message.token;
				ws.output({ 'status':'success', 'userid':ws.userid, 'token':ws.token, 'callback_id':message.callback_id });
				return;
		}

		if(!ws.userid || !ws.token || !mr_api.checkToken(ws.token, ws.userid)) {
			ws.output({ 'status': 'error', 'message': 'Unauthorized access attempt userid = '+ws.userid+' token = '+ws.token, 'callback_id':message.callback_id });
			return;
		}

		switch(message.action) {
			case 'viewmeeting':
				mr_api.getMeetings({
					'userid'	: ws.userid,
					'id'		: message.id
				}, function (data) {
					if(data.status === 'success') {
						var meetingdata = data.meetings[0];
						
						viewers.addViewer({
							'userid'	: ws.userid,
							'meetingid'	: meetingdata.id,
							'socket'	: ws
						});

						ws.meetingid = meetingdata.id;
					}

					data.callback_id = message.callback_id;
					ws.output(data);
				});
				break;
			case 'leavemeeting':
				viewers.removeViewer({
					'userid'	: ws.userid,
					'meetingid'	: message.id
				});
				break;
			case 'addminutes':
				viewers.pushUpdate({
					'userid'	: ws.userid,
					'meetingid'	: ws.meetingid,
					'message'	: message,
					'socketid'	: ws.id
				});
				break;
			case 'updateminutes':
				/* not doing update on typing right now
				mr_api.updateMinutes({
					'userid'	: ws.userid,
					'id'		: message.id,
					'itemid'	: message.itemid,
					'content'	: message.content
				}, function (data) {
					if(data.status === 'success') {
					*/
						viewers.pushUpdate({
							'userid'	: ws.userid,
							'meetingid'	: ws.meetingid,
							'message'	: message,
							'socketid'	: ws.id
						});
				/*
					}

					ws.output(data);
				});
				*/
				break;
			case 'additem':
				viewers.pushUpdate({
					'userid' : ws.userid,
					'meetingid' : ws.meetingid,
					'message' : message,
					'socketid' : ws.id
				});
				break;
			case 'updateitem':
				viewers.pushUpdate({
					'userid' : ws.userid,
					'meetingid' : ws.meetingid,
					'message' : message,
					'socketid' : ws.id
				});
				break;
			default:
				ws.output({ 'status': 'error', 'message': 'Unrecognized action ('+message.action+')' });
				break;

		}

		console.log(JSON.stringify(message));
	});

	ws.on('close', function () {
		viewers.removeViewer({
			'userid'	: ws.userid,
			'meetingid'	: ws.meetingid
		});
	});
});

/*
process.on('uncaughtException', function (error) {
	console.log(error.stack);
});
*/
