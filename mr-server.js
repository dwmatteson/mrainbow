// mr-server.js : Meeting Rainbow API Server
// Author : Dave Matteson

var MRAPI = require('./mr-api.js');

var mr_api = MRAPI.create({
	'mysql_server' : 'localhost', 
	'mysql_username' : 'mrainbow', 
	'mysql_password' : 'pVal!mdx8Q-D#', 
	'mysql_database' : 'mrainbow'
});

if(mr_api.err) {
	console.log('mr-server: Aborting.');
	exit;
}

var http = require('http');

var server = http.createServer(function (req, res) {
	res.writeHead(200, {'Content-type' : 'text/json'});

	var query = require('url').parse(req.url, true).query;

	var output = function (message) {
		res.end(JSON.stringify(message));
	}

	if(!query.action) {
		res.end(JSON.stringify({
			'status'	: 'error',
			'message'	: 'No action'
		}));
		return;
	}

	// API calls that don't require login
	switch(query.action) {
		case 'login':
			mr_api.login({
				'email'		: query.email,
				'password'	: query.password
			}, output);
			return;
		case 'adduser':
			mr_api.addUser({
				'email'		: query.email,
				'password'	: query.password,
				'name'		: query.name,
				'temppass'	: query.temppass,
				'inviter'	: query.inviter
			}, output);
			return;
	}

	// Check for login for any other API calls
	if(!query.userid || !query.token || !mr_api.checkToken(query.token, query.userid)) {
		res.end(JSON.stringify({
			'status'	: 'error',
			'message'	: 'Unauthorized access'
		}));
		return;
	}

	switch(query.action) {
		case 'updateuser':
			mr_api.updateUser({
				'id'	: query.userid,
				'email' : query.email,
				'password' : query.password,
				'name'	: query.name,
				'token'	: query.token
			}, output);
			break;
		case 'getmyprofile':
			mr_api.getMyProfile({
				'userid'	: query.userid
			}, output);
			break;
		case 'getuser':
			mr_api.getUser({
				'id'	: query.id,
				'email'	: query.email,
				'name'	: query.name
			}, output);
			break;
		case 'addmeeting':
			mr_api.addMeeting({
				'userid'	: query.userid,
				'name'		: query.name,
				'startdate'	: query.startdate,
				'frequency'	: query.frequency,
				'manualdays'	: query.manualdays,
				'lastid'	: query.lastid,
				'duration'	: query.duartion,
				'public'	: query.public
			}, output);
			break;
		case 'updatemeeting':
			mr_api.updateMeeting({
				'userid'	: query.userid,
				'id'		: query.id,
				'name'		: query.name,
				'startdate'	: query.startdate,
				'frequency'	: query.frequency,
				'manualdays'	: query.manualdays,
				'duration'	: query.duration,
				'status'	: query.status,
				'public'	: query.public
			}, output);
			break;
		case 'getmeetings':
			mr_api.getMeetings({
				'userid'	: query.userid,
				'id'		: query.id,
				'startdate'	: query.startdate
			}, output);
			break;
		case 'addnextmeeting':
			mr_api.addNextMeeting({
				'userid'	: query.userid,
				'meetingid'	: query.meetingid
			}, output);
			break;
		case 'additem':
			mr_api.addItem({
				'userid'	: query.userid,
				'name'		: query.name,
				'meetingid'	: query.meetingid,
				'ownerid'	: query.ownerid,
				'sortorder'	: query.sortorder,
				'superid'	: query.superid
			}, output);
			break;
		case 'updateitem':
			mr_api.updateItem({
				'userid'	: query.userid,
				'id'		: query.id,
				'name'		: query.name,
				'meetingid'	: query.meetingid,
				'ownerid'	: query.ownerid,
				'sortorder'	: query.sortorder,
				'superid'	: query.superid
			}, output);
			break;
		case 'deleteitem':
			mr_api.deleteItem({
				'userid'	: query.userid,
				'id'		: query.id
			}, output);
			break;
		case 'getitems':
			mr_api.getItems({
				'userid'	: query.userid,
				'meetingid'	: query.meetingid,
			}, output);
			break;
		case 'addminutes':
			mr_api.addMinutes({
				'userid'	: query.userid,
				'itemid'	: query.itemid,
				'content'	: query.content
			}, output);
			break;
		case 'updateminutes':
			mr_api.updateMinutes({
				'userid'	: query.userid,
				'id'		: query.id,
				'itemid'	: query.itemid,
				'content'	: query.content
			}, output);
			break;
		case 'getminutes':
			mr_api.getMinutes({
				'userid'	: query.userid,
				'meetingid'	: query.meetingid
			}, output);
			break;
		case 'addattendee':
			mr_api.addAttendee({
				'userid'	: query.userid,
				'meetingid'	: query.meetingid,
				'attendeeid'	: query.attendeeid,
				'memo'		: query.memo
			}, output);
			break;
		case 'updateattendee':
			mr_api.updateAttendee({
				'userid'	: query.userid,
				'id'		: query.id,
				'attendeeid'	: query.attendeeid,
				'meetingid'	: query.meetingid,
				'status'	: query.status,
				'memo'		: query.memo
			}, output);
			break;
		case 'getattendees':
			mr_api.getAttendees({
				'userid'	: query.userid,
				'meetingid'	: query.meetingid
			}, output);
			break;
		case 'addreminder':
			output(JSON.stringify({ 'status':'error', 'message':'Not yet implemented'}));
			break;
		case 'updatereminder':
			output(JSON.stringify({ 'status':'error', 'message':'Not yet implemented'}));
			break;
		case 'getreminders':
			output(JSON.stringify({ 'status':'error', 'message':'Not yet implemented'}));
			break;
		default:
			res.end(JSON.stringify({
				'status' : 'error',
				'message' : 'Unrecognized action ('+query.action+')'
			}));
			break;
	}

	return;
});

server.listen(7878, 'localhost');

/*
process.on('uncaughtException', function (error) {
	console.log(error.stack);
});
*/
