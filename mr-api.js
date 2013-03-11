// mr-api.js - Meeting Rainbow API Object
// Author : Dave Matteson

exports.create = function (config) {
	var self = this;

	// PROTECTED

	//// CONFIGURATION STUFF
	var dateFormat = require('dateformat');
	var extend = require('extend');
	var uuid = require('node-uuid');
	var md5 = require('MD5');

	var salt = 'oPcxZq!n-^vEuq!d';
	var tokens = { 
		'7213bcae-4130-4547-9c6f-35b694840bc3' : { 'userid' : '029a38a3-e8a0-460d-95d2-3dfcaa74997a', 'expire' : '9999999999' } 
	};

	var mysql = require('mysql');
	var db = mysql.createConnection({
		'host'		: config.mysql_server,
		'user'		: config.mysql_username,
		'password'	: config.mysql_password,
		'database'	: config.mysql_database,
		'multipleStatements' : true
	});

	db.connect(function (err) {
		if(err) {
			console.log('MRAPI: Fatal MySQL Error: '+err.code);
			self.err = true;
		}
	});

	db.config.queryFormat = function (query, values) {
		if (!values) return query;
		return query.replace(/\:(\w+)/g, function (txt, key) {
			if (1 || values.hasOwnProperty(key)) {
				return this.escape(values[key]);
			}
			return txt;
		}.bind(this));
	};

	var nodemailer = require('nodemailer');

	var smtpTransport = nodemailer.createTransport('SMTP', {
		'service'	: 'Gmail',
		'auth'		: { 'user': 'mtgrainbow@gmail.com', 'pass': 'coldheartofstone' }
	});

	var mail_from = 'Meeting Rainbow Support <mtgrainbow@gmail.com>';

	//// UTILITY FUNCTIONS
	var errorMessage = function (message) {
		var error = {
			'status'	: 'error',
			'message'	: message
		};
		return JSON.stringify(error);
	};

	var mysqlError = function (mysql_err) {
		var error = errorMessage('MySQL Error :'+mysql_err.code+')');
		return error;
	};

	var successMessage = function (data) {
		var success = {
			'status' : 'success',
		};

		extend(success, data);

		return JSON.stringify(success);
	};

	var nowTime = function() {
		return Math.round(new Date().getTime() / 1000);
	};

	var createToken = function (userid) {
		var token = uuid.v4();
		tokens[token] = { 'userid':userid, 'expire': nowTime() + (3 * 3600) };
		return token;
	};

	var expireTokens = function () {
		var now = nowTime();
		console.log('before expire: tokens = '+JSON.stringify(tokens));
		for(token in tokens) {
			if(tokens[token].expire < now) {
				delete tokens[token];
			}
		}
		console.log('after expire: tokens = '+JSON.stringify(tokens));
	};

	var encryptPassword = function (password) {
		return md5(password+salt);
	};

	var checkRequired = function (requireds, fields) {
		var missings = '';

		for(key in requireds) {
			if(!fields[requireds[key]]) {
				missings = missings + requireds[key] + ', ';
			}
		}

		if(missings) {
			missings = 'Missing required field(s). ('+ missings.substring(0, missings.length-2)+')';
		}

		return missings;
	};

	var calculateNextDate = function (startdate, frequency, manualdays) {
		var nextdate = null;

		if(frequency != 'Never') {
			nextdate = new Date(startdate);

			switch(frequency) {
				case 'Manual':
					nextdate.setDate(nextdate.getDate() + parseInt(manualdays, 10));
					break;
				case 'Daily':
					nextdate.setDate(nextdate.getDate() + 1);
					break;
				case 'Weekly':
					nextdate.setDate(nextdate.getDate() + 7);
					break;
				case 'Monthly':
					nextdate.setMonth(nextdate.getMonth() + 1);
					break;
				case 'Semimonthly':
					nextdate.setMonth(nextdate.getMonth() + 2);
					break;
				case 'Quarterly':
					nextdate.setMonth(nextdate.getMonth() + 3);
					break;
				case 'Biannually':
					nextdate.setMonth(nextdate.getMonth() + 6);
					break;
				case 'Yearly':
					nextdate.setMonth(nextdate.getMonth() + 12);
					break;
			}

			nextdate = dateFormat(nextdate, "yyyy-mm-dd HH:MM:ss");
		}

		return nextdate;
	};

	var checkMeetingPermission = function (meetingid, userid, cb) {
		var query = db.query('SELECT * FROM meetings WHERE id = :id', { 'id' : meetingid }, function (err, result) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on SELECT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				//ouptut(message);
				cb(false);
				return;
			}

			var meeting = result[0];

			if(meeting === undefined || (meeting.userid != userid && !meeting.public)) {
				cb(false, meeting);
			}
			else {
				cb(true, meeting);
			}
		});
	};

	var checkItemPermission = function (itemid, userid, cb) {
		var query = db.query('SELECT meetings.userid AS meetinguserid, meetings.public AS meetingpublic, items.* FROM meetings, items WHERE items.id = :itemid AND meetings.id = items.meetingid', { 'itemid' : itemid }, function (err, result) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on SELECT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				//ouptut(message);
				cb(false);
				return;
			}

			var item = result[0];

			if(item.meetinguserid != userid && !item.meetingpublic) {
				cb(false, item);
			}
			else {
				cb(true, item);
			}
		});
	};

	var checkMinutesPermission = function (minutesid, userid, cb) {
		var query = db.query('SELECT meetings.userid AS meetinguserid, meetings.public AS meetingpublic, minutes.* FROM meetings, items, minutes WHERE minutes.id = :minutesid AND items.id = minutes.itemid AND meetings.id = items.meetingid', { 'minutesid' : minutesid }, function (err, result) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on SELECT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				//ouptut(message);
				cb(false);
				return;
			}

			var minutes = result[0];

			if(minutes.meetinguserid != userid && !minutes.meetingpublic) {
				cb(false, minutes);
			}
			else {
				cb(true, minutes);
			}
		});
	};

	var checkAttendeePermission = function (attendeeid, userid, cb) {
		var query = db.query('SELECT meetings.userid AS meetinguserid, meetings.public AS meetingpublic, attendees.* FROM meetings, attendees WHERE attendees.id = :attendeeid AND meetings.id = attendees.meetingid', { 'attendeeid' : attendeeid }, function (err, result) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on SELECT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				//ouptut(message);
				cb(false);
				return;
			}

			var attendee = result[0];

			if(attendee.meetinguserid != userid && !item.meetingpublic) {
				cb(false, attendee);
			}
			else {
				cb(true, attendee);
			}
		});
	};

	// PUBLIC FUNCTIONS
	self.checkToken = function (token, userid) {
		expireTokens();

		if(tokens[token] === undefined) { return false; }

		if(tokens[token].userid === userid) { return true; }
		else { return false; }
	};

	//// API CALLS
	self.login = function (fields, output) {
		var missings = checkRequired([ 'email', 'password' ], fields);
		if(missings) {
			var message = errorMessage(missings);
			output(message);
			return false;
		}

		fields.password = encryptPassword(fields.password);

		var post = {
			'email' : fields.email
		};

		var query = db.query('SELECT id, password, name FROM users WHERE email = :email', post, function (err, result) {
			var message = 'No message?';

			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered. Code = '+err.code+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
			}
			else {
				if(result[0] && result[0].password === fields.password) {
					var token = createToken(result[0].id);

					message = successMessage({
						'id' : result[0].id,
						'email' : post.email,
						'name'	: result[0].name,
						'token' : token
					});
				}
				else {
					message = errorMessage('Login failed');
				}

				output(message);
			}
		});
	};

	self.addUser = function (fields, output) {
		var missings = checkRequired([ 'email', 'password', 'name' ], fields);
		if(missings) {
			var message = errorMessage(missings);
			output(message);
			return false; 
		}

		var	new_id = uuid.v4(),
			now = new Date(),
			startdate = dateFormat(now, "yyyy-dd-mm HH:MM:ss");

		var post = {
			'id'		: new_id,
			'email'		: fields.email,
			'password' 	: encryptPassword(fields.password),
			'name'		: fields.name,
			'startdate'	: startdate
		}

		var query = db.query('INSERT INTO users SET id = :id, email = :email, password = :password, name = :name, startdate = :startdate', post, function (err, result) {
			var message = 'No Message?';

			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered. Code = '+err.code+'\n message = '+message+'\npost = '+JSON.stringify(post)+'\n');
			}
			else {
				message = successMessage({
					'id'	: new_id,
					'email'	: fields.email,
					'name'	: fields.name,
					'startdate' : startdate
				});

				if(fields.temppass) {
					var mailOptions = {
						'from'	: mail_from,
						'to'	: fields.email,
						'subject': 'Welcome to Meeting Rainbow!'
					};

					mailOptions.text = "Hey there,\n\n"+fields.inviter+" just invited you to a meeting on our site. I made you an account with a temporary password, which can be found below. You can log in at meetingrainbow.com, change your password, and check out the meeting agenda.\n\nTemporary Password: "+fields.temppass+" (Please change)\n\nIf you have no interest, I'm sorry that you were bothered with this email. Please delete it and know you'll never get another.\n\nDave";

					smtpTransport.sendMail(mailOptions, function (error, response) {
						if(error) {
							console.log(error);
						}
						else {
							console.log("Message sent: "+response.message);
						}
					});
				}
			}

			output(message);
		});
	};

	self.updateUser = function (fields, output) {
		var missings = checkRequired([ 'id' ], fields);
		if(missings) {
			var message = errorMessage(missings);
			output(message);
			return false;
		}

		if(fields.password) {
			fields.password = encryptPassword(fields.password);
		}

		var	post = { 'id' : fields.id };

		var query = db.query('SELECT email, password, name FROM users WHERE id = :id', post, function (err, result) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on SELECT. Code = '+err.code+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				output(message);
				return;
			}

			console.log('result = '+JSON.stringify(result));
			for(key in result[0]) {
				if(fields[key]) {
					post[key] = fields[key];
				}
				else {
					post[key] = result[0][key];
				}
			}
			console.log('post = '+JSON.stringify(post)+'\n');

			var query = db.query('UPDATE users SET email = :email, password = :password, name = :name WHERE id = :id', post, function (err, result) {
				var message = 'No Message?';

				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on UPDATE. Code = '+err.code+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage({
						'id'	: post.id,
						'email'	: post.email,
						'name'	: post.name,
						'startdate' : post.startdate
					});
				}

				output(message);
			});
		});
	};

	self.getMyProfile = function (fields, output) {
		var missings = checkRequired([ 'userid' ], fields);
		var message = '';
		if(missings) {
			var message = errorMessage(missings);
			output(message);
			return false;
		}

		var post = { 'userid' : fields.userid };

		var query = db.query('SELECT name, email, startdate FROM users WHERE id = :userid', post, function (err, result) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on SELECT. Code = '+err.code+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
			}
			else {
				var data = result[0];

				message = successMessage({
					'email'	: data.email,
					'name'	: data.name,
					'startdate' : data.startdate
				});
			}

			output(message);
		});
	};

	self.getUser = function (fields, output) { 
		var message = '';
		if(!fields.email && !fields.name && !fields.id) {
			message = errorMessage('Email, name or id is required.');
			output(message);
			return false;
		}

		var querystring = 'SELECT users.id, users.name  FROM users WHERE ';

		if(fields.id) {
			querystring = querystring + 'id = :id';
		}
		else if(fields.email) {
			querystring = querystring + 'email = :email';
		}
		else if(fields.name) {
			querystring = querystring + 'name = :name';
		}

		post = {
			'id'	: fields.id,
			'email'	: fields.email,
			'name'	: fields.name
		};

		var query = db.query(querystring, post, function (err, result) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on INSERT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
			}
			else {
				message = successMessage(result[0]);
			}
			output(message);
		});
	};

	self.addMeeting = function (fields, output) {
		var missings = checkRequired([ 'userid', 'name', 'startdate', 'frequency' ], fields);
		if(missings) {
			var message = errorMessage(missings);
			output(message);
			return false;
		}

		var new_id = uuid.v4();

		var post = {
			'id'		: new_id,
			'userid'	: fields.userid,
			'name'		: fields.name,
			'startdate'	: fields.startdate,
			'frequency'	: fields.frequency,
			'status'	: 'Scheduled'
		}

		post.manualdays = null;

		if(fields.frequency === 'Never') {
			post.nexdate = null;
		}
		else {
			post.nextdate = calculateNextDate(fields.startdate, fields.frequency, fields.manualdays);

			if(fields.frequency === 'Manual') {
				post.manualdays = fields.manualdays;
			}
		}

		if(fields.lastid) {
			post.lastid = fields.lastid;
		}
		else {
			post.lastid = null;
		}

		if(fields.duration) {
			post.duration = fields.duration;
		}
		else {
			post.duration = null;
		}

		if(fields.public) {
			post.public = fields.public;
		}
		else {
			post.public = null;
		}

		var query = db.query('INSERT INTO meetings SET id = :id, userid = :userid, name = :name, startdate = :startdate, frequency = :frequency, status = :status, nextdate = :nextdate, manualdays = :manualdays, lastid = :lastid, duration = :duration, public = :public', post, function (err, result) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on INSERT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
			}
			else {
				message = successMessage(post);
			}

			output(message);
		});
	};

	self.updateMeeting = function (fields, output) {
		var missings = checkRequired([ 'id', 'userid' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkMeetingPermission(fields.id, fields.userid, function (permission, meeting) {
			if(!permission) {
				message = errorMessage('User is not authorized to modify this meeting.');
				output(message);
				return;
			}

			post = {};

			for(var key in meeting) {
				if(fields[key] === null || fields[key] === 0 || fields[key]) {
					post[key] = fields[key];
				}
				else {
					post[key] = meeting[key];
				}
			}

			// Do we need to recalculate the next date?
			if(post.frequency != meeting.frequency || post.manualdays != meeting.manualdays || post.startdate != meeting.startdate) {
				post.nextdate = calculateNextDate(post.startdate, post.frequency, post.manualdays);

				// Update the next meeting if necessary
				if(post.nextid != null) {
					self.updateMeeting({
						'id'		: post.nextid,
						'userid'	: post.userid,
						'startdate'	: post.nextdate,
						'frequency'	: post.frequency,
						'manualdays'	: post.manualdays
					}, function (message) { return; });
				}
			}

			var query = db.query('UPDATE meetings SET name = :name, startdate = :startdate, nextdate = :nextdate, frequency = :frequency, manualdays = :manualdays, lastid = :lastid, nextid = :nextid, duration = :duration, status = :status, public = :public WHERE id = :id', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on UPDATE. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage({
						'id'		: post.id,
						'userid'	: post.userid,
						'name'		: post.name,
						'startdate'	: post.startdate,
						'nextdate'	: post.nextdate,
						'frequency'	: post.frequency,
						'manualdays'	: post.manualdays,
						'lastid'	: post.lastid,
						'nextid'	: post.nextid,
						'duration'	: post.duration,
						'status'	: post.status,
						'public'	: post.public
					});
				}

				output(message);
			});
		});
	};

	self.getMeetings = function (fields, output) {
		var post = {
			'userid'	: fields.userid,
			'id'		: fields.id,
			'startdate'	: fields.startdate
		};

		var querystring = 'SELECT meetings.* FROM meetings, attendees WHERE meetings.id = attendees.meetingid AND meetings.userid != :userid AND attendees.attendeeid = :userid ; SELECT meetings.* FROM meetings WHERE meetings.userid = :userid';
		if(post.id) {
			querystring = 'SELECT meetings.* FROM meetings WHERE meetings.id = :id';
		}
		else if(post.startdate) {
			querystring =  'SELECT meetings.* FROM meetings WHERE meetings.startdate = :startdate';
		}

		var query = db.query(querystring, post, function (err, results) {
			if(err) {
				message = mysqlError(err);
				console.log('MySQL error encountered on UPDATE. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
			}
			else {
				var meetings = [], result = [];

				if(results[0].id) {
					result = results;
				}
				else {
					for(var i in results) {
						if(results[i] && results[i][0] && results[i][0].id) {
							for(var j in results[i]) {
								result.push(results[i][j]);
							}
						}
					}
				}

				console.log('result = '+JSON.stringify(result)+' results = '+JSON.stringify(results));

				for(var i in result) {
					meetings.push(result[i]);
				}
				message = successMessage({
					'userid'	: post.userid,
					'id'		: post.id,
					'startdate'	: post.startdate,
					'meetings'	: meetings
				});
			}

			output(message);
		});
	};

	self.addItem = function (fields, output) {
		var missings = checkRequired([ 'userid', 'name', 'meetingid', 'sortorder' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkMeetingPermission(fields.meetingid, fields.userid, function (permission, meeting) {
			if(!permission) {
				message = errorMessage('User is not authorized to add items to this meeting.');
				output(message);
				return;
			}

			var post = {
				'id'		: uuid.v4(),
				'name'		: fields.name,
				'meetingid'	: fields.meetingid,
				'userid'	: fields.userid,
				'ownerid'	: fields.ownerid,
				'sortorder'	: fields.sortorder
			};

			if(!post.ownerid) {
				post.ownerid = post.userid;
			}

			var query = db.query('INSERT INTO items SET id = :id, name = :name, meetingid = :meetingid, userid = :userid, ownerid = :ownerid, sortorder = :sortorder', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on INSERT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage(post);
				}

				output(message);
			});
		});
	};

	self.updateItem = function (fields, output) {
		var missings = checkRequired([ 'userid', 'id' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkItemPermission(fields.id, fields.userid, function (permission, item) {
			if(!permission) {
				message = errorMessage('User is not authorized to update items on this meeting.');
				output(message);
				return;
			}

			var post = {};

			for(key in item) {
				if(fields[key] === null || fields[key] === 0 || fields[key]) {
					post[key] = fields[key];
				}
				else {
					post[key] = item[key];
				}
			}

			var query = db.query('UPDATE items SET name = :name, ownerid = :ownerid, sortorder = :sortorder WHERE id = :id', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on UPDATE. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage(post);
				}

				output(message);
			});
		});
	};

	self.deleteItem = function (fields, output) {
		var missings = checkRequired([ 'userid', 'id' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkItemPermission(fields.id, fields.userid, function (permission, item) {
			if(!permission) {
				message = errorMessage('User is not authorized to delete items on this meeting.');
				output(message);
				return;
			}

			var post = { 'id' : fields.id };

			var query = db.query('DELETE FROM items WHERE id = :id', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on DELETE. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage({ 'id' : post.id });
				}

				output(message);
			});
		});
	};

	self.getItems = function (fields, output) {
		var missings = checkRequired([ 'userid', 'meetingid' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkMeetingPermission(fields.meetingid, fields.userid, function (permission, meeting) {
			if(!permission) {
				message = errorMessage('User is not authorized to retrieve items on this meeting.');
				output(message);
				return;
			}

			post = { 
				'meetingid'	: fields.meetingid,
				'userid'	: fields.userid
			};

			var query = db.query('SELECT items.* FROM items, meetings WHERE meetings.id = :meetingid AND items.meetingid = meetings.id ORDER BY items.sortorder ASC', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on SELECT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					var items = [];

					for(var i in result) {
						items.push(result[i]);
					}
					
					message = successMessage({
						'meetingid'	: post.meetingid,
						'userid'	: post.userid,
						'items'		: items
					});
				}

				output(message);
			});
		});
	};

	self.addMinutes = function (fields, output) {
		console.log('Entered addMinutes');
		var missings = checkRequired([ 'userid', 'itemid', 'content' ], fields);
		var message = '';

		console.log('Checked required fields, missings = '+missings);

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		console.log('Checking perimssion itemid = '+fields.itemid+', userid = '+fields.userid);
		checkItemPermission(fields.itemid, fields.userid, function (permission, item) {
			if(!permission) {
				message = errorMessage('User is not authorized to add minutes to this item.');
				output(message);
				return;
			}

			console.log('User does have permission.');

			var post = {
				'id'		: uuid.v4(),
				'itemid'	: fields.itemid,
				'userid'	: fields.userid,
				'content'	: fields.content
			};

			var query = db.query('INSERT INTO minutes SET id = :id, itemid = :itemid, userid = :userid, content = :content', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on INSERT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage(post);
				}

				output(message);
			});
		});
	};

	self.updateMinutes = function (fields, output) {
		var missings = checkRequired([ 'userid', 'id' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkMinutesPermission(fields.id, fields.userid, function (permission, minutes) {
			if(!permission) {
				message = errorMessage('User is not authorized to update minutes on this meeting.');
				output(message);
				return;
			}

			var post = {};

			for(key in minutes) {
				if(fields[key] === null || fields[key] === 0 || fields[key]) {
					post[key] = fields[key];
				}
				else {
					post[key] = minutes[key];
				}
			}

			var query = db.query('UPDATE minutes SET content = :content WHERE id = :id', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on UPDATE. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage(post);
				}

				output(message);
			});
		});
	};

	self.getMinutes = function (fields, output) {
		var missings = checkRequired([ 'userid', 'meetingid' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkMeetingPermission(fields.meetingid, fields.userid, function (permission, meeting) {
			if(!permission) {
				message = errorMessage('User is not authorized to retrieve items on this meeting.');
				output(message);
				return;
			}

			post = { 
				'meetingid'	: fields.meetingid,
				'userid'	: fields.userid
			};

			var query = db.query('SELECT minutes.* FROM minutes, items, meetings WHERE meetings.id = :meetingid AND items.meetingid = meetings.id AND minutes.itemid = items.id', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on SELECT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					var minutes = [];

					for(var i in result) {
						minutes.push(result[i]);
					}
					
					message = successMessage({
						'meetingid'	: post.meetingid,
						'userid'	: post.userid,
						'minutes'	: minutes
					});
				}

				output(message);
			});
		});
	};

	self.addAttendee = function (fields, output) {
		var missings = checkRequired([ 'userid', 'attendeeid', 'meetingid' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkMeetingPermission(fields.meetingid, fields.userid, function (permission, meeting) {
			if(!permission) {
				message = errorMessage('User is not authorized to add attendees to this meeting.');
				output(message);
				return;
			}

			var post = {
				'id'		: uuid.v4(),
				'attendeeid'	: fields.attendeeid,
				'meetingid'	: fields.meetingid,
				'status'	: 'Pending',
				'memo'		: fields.memo
			};

			var query = db.query('INSERT INTO attendees SET id = :id, attendeeid = :attendeeid, meetingid = :meetingid, status = :status, memo = :memo', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on INSERT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage({
						'id'		: post.id,
						'attendeeid'	: fields.attendeeid,
						'meetingid'	: fields.meetingid,
						'memo'		: fields.memo
					});
				}

				output(message);
			});
		});
	};

	self.updateAttendee = function (fields, output) {
		var missings = checkRequired([ 'userid', 'id' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkAttendeePermission(fields.id, fields.userid, function (permission, attendee) {
			if(!permission) {
				message = errorMessage('User is not authorized to update attendees on this meeting.');
				output(message);
				return;
			}

			var post = {};

			for(key in attendee) {
				if(fields[key] === null || fields[key] === 0 || fields[key]) {
					post[key] = fields[key];
				}
				else {
					post[key] = attendee[key];
				}
			}

			var query = db.query('UPDATE attendees SET status = :status, memo = :memo WHERE id = :id', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on UPDATE. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					message = successMessage(post);
				}

				output(message);
			});
		});
	};

	self.getAttendees = function (fields, output) {
		var missings = checkRequired([ 'userid', 'meetingid' ], fields);
		var message = '';

		if(missings) {
			message = errorMessage(missings);
			output(message);
			return false;
		}

		checkMeetingPermission(fields.meetingid, fields.userid, function (permission, meeting) {
			if(!permission) {
				message = errorMessage('User is not authorized to retrieve items on this meeting.');
				output(message);
				return;
			}

			post = { 
				'meetingid'	: fields.meetingid,
				'userid'	: fields.userid
			};

			var query = db.query('SELECT users.name,attendees.* FROM attendees, meetings, users WHERE meetings.id = :meetingid AND attendees.meetingid = meetings.id AND users.id = attendees.attendeeid', post, function (err, result) {
				if(err) {
					message = mysqlError(err);
					console.log('MySQL error encountered on SELECT. err = '+JSON.stringify(err)+'\nmessage = '+message+'\npost = '+JSON.stringify(post)+'\n');
				}
				else {
					var attendees = [];

					for(var i in result) {
						attendees.push(result[i]);
					}
					
					message = successMessage({
						'meetingid'	: post.meetingid,
						'userid'	: post.userid,
						'attendees'	: attendees
					});
				}

				output(message);
			});
		});
	};

	return self;
}

