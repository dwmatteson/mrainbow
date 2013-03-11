
var mr_webapp = (function () {
	var	self = this,
		current_page = 'login-form';

	var	USER_COOKIE = 'mr_u',
		NAME_COOKIE = 'mr_n',
		TOKEN_COOKIE = 'mr_t',
		PAGE_COOKIE = 'mr_p',
		LOAD_COOKIE = 'mr_l';

	self.validEmail = function (email) {
		var regex = /^([a-zA-Z0-9_\.\-\+])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
		return regex.test(email);
	};

	self.generatePassword = function () {
		var	length = 8,
			charset = "abcdefghijklnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
			retVal = "";
		for (var i = 0, n = charset.length; i < length; ++i) {
			retVal += charset.charAt(Math.floor(Math.random() * n));
		}
		return retVal;
	};

	self.toggleCheck = function (id) {
		if($("#"+id).attr('checked')) {
			$("#"+id).removeAttr('checked');
			$("#"+id+"-label").removeClass('checked');
		}
		else {
			$("#"+id).attr('checked', 'checked');
			$("#"+id+"-label").addClass('checked');
		}
	};

	self.clearBoxes = function () {
		$('#error-box').hide();
		$('#success-box').hide();
	};

	self.showError = function (text) {
		self.clearBoxes();
		$('#error-text').html(text);
		$('#error-box').show();
	};

	self.showSuccess = function (text) {
		self.clearBoxes();
		$('#success-text').html(text);
		$('#success-box').show();
	};

	self.setPage = function (new_page) {
		self.clearBoxes();
		$('#'+current_page).hide();
		$('#'+new_page).show();
		current_page = new_page;
		location.hash = '';
		$.cookie(PAGE_COOKIE, new_page);
	};
	
	self.showLoginForm = function () {
		$.cookie(USER_COOKIE, '');
		$.cookie(NAME_COOKIE, '');
		$.cookie(TOKEN_COOKIE, '');
		mr_api.userid = '';
		mr_api.token = '';
		self.setPage('login-form');
		return false;
	};

	self.showRegisterForm = function () {
		self.setPage('register-form');
		return false;
	};

	self.addMeeting = function () {
		var fields = {
			'action'	: 'addmeeting',
			'name'		: $("#meeting-name").val(),
			'startdate'	: $("#meeting-startdate").val(),
			'frequency'	: $("#meeting-frequency").val(),
			'manualdays'	: $("#meeting-manualdays").val(),
			'duration'	: $("#meeting-duration").val(),
			'public'	: 1 
		};

		mr_api.action(fields, function (data) {
			self.showMeetingsPage();
			if(data.status === 'error') {
				showError('There was an error: '+data.message);
			}
			else {
				mr_api.action({ 'action':'addattendee', 'attendeeid':mr_api.userid, 'meetingid':data.id }, function (data) {
					if(data.status !== 'success') {
						console.log('Error adding attendee id = '+mr_api.userid+' to meeting id = '+data.id);
					}
				});
				showSuccess('Boom! Meeting added!');
			}
		});

		return false;
	};

	self.updateMeeting = function (meetingid) {
		var fields = {
			'action'	: 'updatemeeting',
			'id'		: meetingid,
			'name'		: $("#meeting-name").val(),
			'startdate'	: $("#meeting-startdate").val(),
			'frequency'	: $("#meeting-frequency").val(),
			'manualdays'	: $("#meeting-manualdays").val(),
			'duration'	: $("#meeting-duration").val(),
			'public'	: 1 
		};

		mr_api.action(fields, function (data) {
			if(data.status === 'error') {
				showError('There was an error: '+data.message);
			}
			else {
				showSuccess('Your changes have been saved.');
			}
		});

		return false;
	};

	self.clearMeetingForm = function () {
		$("[id^=meeting-]").val('');
		//$("#meeting-public").removeAttr('checked');
		//$("#meeting-public-label").removeClass('checked');
		$("#meeting-button").off('click');
		$("#meeting-button").on('click', addMeeting);

		$.cookie(LOAD_COOKIE, '');
	};

	self.showMeetingForm = function () {
		self.setPage('meeting-form');
		return false;
	};

	self.editMeeting = function (meetingid) {
		mr_api.action({ 'action':'getmeetings', 'id':meetingid }, function (data) {
			var meeting = data.meetings[0];

			for(var key in meeting) {
				//if(key === 'public') { 
				//	self.toggleCheck('meeting-public'); 
				//}
				if(key === 'startdate') {
					var d  = new Date(meeting[key]);
					meeting[key] = d.getFullYear()+'-'+(parseInt(d.getMonth())+1)+'-'+d.getDate()+' '+d.getHours()+':'+d.getMinutes();
				}
				$('#meeting-'+key).val(meeting[key]);
			}

			$("#meeting-button").off('click');
			$("#meeting-button").on('click', function () { self.updateMeeting(meetingid); });

			$.cookie(LOAD_COOKIE, meetingid);

			self.showMeetingForm();
		});
	};

	self.viewAttendees = function (meetingid) {
		mr_api.action({ 'action':'getattendees', 'meetingid':meetingid }, function (data) {
			var attendee_names = '';
			if(data.status === 'success') {
				for(var i in data.attendees) {
					attendee_names = attendee_names + '<li>' + data.attendees[i].name + '</li>';
				}
				if(!attendee_names) {
					attendee_names = '<li>None</li>';
				}
			}
			else {
				attendee_names = 'Error retrieving attendees';
				console.log('Error retrieving attendees for meeting id = '+meetingid+' message = '+data.message);
			}
			$('#meeting-attendees').html(attendee_names);
		});

	};

	self.updateItem = function (meetingid, itemid) {
		getUser({ 'name' : $('#'+itemid+'-ownername').val(), 'itemid' : itemid }, function (data) {
			var fields  = {
				'action'	: 'updateitem',
				'id'		: itemid,
				'name'		: $('#'+itemid+'-name').val(),
				'sortorder'	: $('#'+itemid+'-sortorder').val(),
				'ownerid'	: data.id
			};
			mr_api.action(fields, function (data) {
				if(data.status === 'success') {
					viewMeeting(meetingid);
				}
				else {
					showError('Error updating item id = '+itemid+' message = '+data.message);
				}
			});
		});

		return false;
	};

	self.deleteItem = function (meetingid, itemid) {
		var fields = {
			'action'	: 'deleteitem',
			'id'		: itemid
		};
		mr_api.action(fields, function (data) {
			if(data.status === 'success') {
				viewMeeting(meetingid);
			}
			else {
				showError('Error deleting item id = '+itemid+' message = '+data.message);
			}
		});
	};

	self.addItemMinutes = function (itemid, meetingid) {
		var fields = {
			'action'	: 'addminutes',
			'itemid'	: itemid,
			'content'	: $('#'+itemid+'-content-new').val()
		};
		mr_api.action(fields, function (data) {
			if(data.status === 'success') {
				self.viewMeeting(meetingid);
			}
			else {
				showError('There was a problem adding these minutes.');
				console.log('Error adding minutes to item id = '+itemid+' message = '+data.message);
			}
		});

		return false;
	};

	self.updateItemMinutes = function (minutesid, meetingid) {
		var fields = {
			'action'	: 'updateminutes',
			'id'		: minutesid,
			'content'	: $('#'+minutesid+'-content').val()
		};
		mr_api.action(fields, function (data) {
			if(data.status === 'success') {
				self.viewMeeting(meetingid);
			}
			else {
				showError('There was a problem updating these minutes.');
				console.log('Error updating minutes id = '+minutesid+' message = '+data.message);
			}
		});

		return false;
	};

	self.viewMinutes = function (meetingid) {
		mr_api.action({ 'action':'getminutes', 'meetingid':meetingid }, function (data) {
			if(data.minutes && data.minutes.length > 0) {
				for(var i in data.minutes) {
					var itemid = data.minutes[i].itemid;

					$('#'+itemid+'-name-cell').append('<textarea class="minutes" id="'+data.minutes[i].id+'-content">'+data.minutes[i].content+'</textarea>');
					$('#'+itemid+'-owner-cell').append('<button class="btn btn-info" id="'+data.minutes[i].id+'-minutes-button">Save</button>');
					$('#'+data.minutes[i].id+'-minutes-button').on('click', function () { self.updateItemMinutes(this.id.substr(0,36), meetingid); });
					$('#'+itemid+'-item-row').off('click');
				}
			}
			else {
			}
		});
	};

	self.viewItems = function (meetingid) {
		mr_api.action({ 'action':'getitems', 'meetingid':meetingid }, function (data) {
			if(data.status === 'success') {
				var contents = '';

				for(var i in data.items) {
					contents = contents + '<tr id="'+data.items[i].id+'-item-row"><td><input type="text" class="input-mini" id="'+data.items[i].id+'-sortorder" value="'+data.items[i].sortorder+'"></td><td id="'+data.items[i].id+'-name-cell"><input type="text" class="input-wide" id="'+data.items[i].id+'-name" value="'+data.items[i].name+'"></td><td id="'+data.items[i].id+'-owner-cell"><input type="text" class="input-small" id="'+data.items[i].id+'-ownername" data-ownerid="'+data.items[i].ownerid+'" value=""></td><td><button type="submit" class="btn btn-success" id="'+data.items[i].id+'-update-button">Update</button><button type="submit" class="btn btn-danger btn-top-spacing" id="'+data.items[i].id+'-delete-button">Delete</button></td></tr>';
				}

				$('#items-table').find('tbody').html(contents);

				$("[id$=-ownername]").each(function () {
					var	ownerid = $(this).data('ownerid'),
						ownerfield = this;
					if(ownerid) {
						self.getUser({ 'id':ownerid }, function (fields) {
							$(ownerfield).val(fields.name);
						});
					}
				});

				$("[id$=-item-row]").each(function () {
					var itemid = this.id.substr(0,36);
					$('#'+itemid+'-item-row').on('click', function () {
						$('#'+itemid+'-name-cell').append('<textarea class="minutes" id="'+itemid+'-content-new" placeholder="Enter Minutes..."></textarea>');
						$('#'+itemid+'-owner-cell').append('<button class="btn btn-primary" id="'+itemid+'-minutes-button-new">Add</button>');
						$('#'+itemid+'-item-row').off('click');
						$('#'+itemid+'-minutes-button-new').on('click', function () { self.addItemMinutes(itemid, meetingid); });
						return false;
					});
				});

				self.viewMinutes(meetingid);

				$("[id$=-update-button]").bind('click', function () { self.updateItem(meetingid, this.id.substr(0,36)); });
				$("[id$=-delete-button]").bind('click', function () { self.deleteItem(meetingid, this.id.substr(0,36)); });
			}
			else {
				showError('Unable to retrieve meeting items. :(');
				console.log('Error retrieving items for meeting id = '+meetingid+' message = '+data.message);
			}
		});
	};

	self.addAttendee = function (fields) {
		mr_api.action({ 'action':'addattendee', 'attendeeid':fields.id, 'meetingid':fields.meetingid }, function (data) {
			if(data.status === 'success') {
				viewMeeting(fields.meetingid);
			}
			else {
				showError('There was an error adding the attendee.');
				console.log('Error adding attendee for meeting id = '+fields.meetingid+' attendee id = '+fields.attendeeid+' message = '+data.message);
			}
		});
	};

	self.findAttendee = function (meetingid) {
		var email = $('#attendee-email').val();
		if(!self.validEmail(email)) {
			showError('Attendee email address does not appear to be valid.');
		}

		self.getUser({ 'meetingid':meetingid, 'email':email }, function (fields) {
			if(fields.id === undefined) {
				var	email_parts = email.split('@'),
					temp_pass = self.generatePassword();
				mr_api.action({ 'action': 'adduser', 'name': email_parts[0], 'email': email, 'password': temp_pass, 'temppass': temp_pass, 'inviter': mr_api.name }, function (data) {
					if(data.status === 'success') {
						self.addAttendee({ 'meetingid':meetingid, 'id':data.id });
					}
					else {
						showError('There was an error registering and adding this attendee.');
					}
				});
			}
			else {
				self.addAttendee({ 'meetingid':meetingid, 'id':fields.id });
			}
		});

		return false;
	};

	self.clearMeetingView = function () {
		$('#attendee-email').val('');
		$('#item-sortorder').val('');
		$('#item-name').val('');
		$('#item-owner').val('');
		$('#attendee-button').off('click');
		$('#item-button').off('click');
	};

	self.addItem = function (fields) {
		fields.action = 'additem';
		fields.name = $('#item-name').val();
		fields.sortorder = $('#item-sortorder').val();

		if(fields.id) { fields.ownerid = fields.id; }

		mr_api.action(fields, function (data) {
			if(data.status === 'success') {
				viewMeeting(fields.meetingid);
			}
			else {
				showError('There was an error adding the item.');
				console.log('Error adding item to meeting id = '+fields.meetingid);
			}
		});
	};

	self.getUser = function (fields, cb) {
		fields.action = 'getuser';
		mr_api.action(fields, function (data) {
			if(data.status === 'success') {
				cb({ 'meetingid':fields.meetingid, 'itemid':fields.itemid, 'id':data.id, 'name':data.name });
			}
			else if(data.id === undefined) {
				showError('No user found for that information.');
			}
			else {
				showError('There was a problem looking up the user.');
				console.log('Error looking up user name = '+$('#item-owner').val()+' message = '+data.message);
			}
		});
	};

	self.viewMeeting = function (meetingid) {
		self.clearMeetingView();
		mr_api.action({ 'action':'getmeetings', 'id':meetingid }, function (data) {
			var meeting = data.meetings[0];

			self.viewAttendees(meetingid);
			self.viewItems(meetingid);

			var show_date = new Date(meeting.startdate).toLocaleString();
			var meeting_details = '<strong>Start Time:</strong><br />'+show_date+'<br /><br />';
			//meeting_details = meeting_details + '<strong>Public:</strong> '+(meeting.public?'Yes':'No')+'<br />';
			if(meeting.duration) { meeting_details = meeting_details + '<strong>Duration:</strong> '+meeting.duration+' minutes<br />'; }
			if(meeting.status) { meeting_details = meeting_details + '<strong>Status:</strong> '+meeting.status+'<br />'; }

			$('#meeting-title').html(meeting.name);
			$('#meeting-details').html(meeting_details);

			$('#attendee-button').on('click', function () { findAttendee(meetingid); });
			$('#item-button').on('click', function () { 
				if($('#item-owner').val() != '') {
					self.getUser({ 'meetingid':meetingid, 'name':$('#item-owner').val() }, addItem);
				}
				else {
					self.addItem({ 'meetingid':meetingid });
				}
			});

			$.cookie(LOAD_COOKIE, meetingid);
			self.setPage('meeting-view');
			document.location.hash = meetingid;
		});

		return false;
	};

	self.populateAttendees = function (meetingid) {
		mr_api.action({ 'action':'getattendees', 'meetingid':meetingid }, function (data) {
			var attendee_names = '';
			if(data.status === 'success') {
				for(var i in data.attendees) {
					attendee_names = attendee_names + data.attendees[i].name + ', ';
				}
				if(attendee_names) {
					attendee_names = attendee_names.substring(0, attendee_names.length-2);
				}
				else {
					attendee_names = 'None';
				}
			}
			else {
				attendee_names = 'Error';
				console.log('Error retrieving attendees for meeting id = '+meetingid+' message = '+data.message);
			}
			$('#'+meetingid+'-attendees').html(attendee_names);
		});
	};

	self.populateMeetingsPage = function () {
		mr_api.action({ 'action': 'getmeetings' }, function (data) {
			if(data.status === 'error') {
				self.showError("Couldn't retrieve meeting data: "+data.message);
				return;
			}

			var contents = '';

			for(var i in data.meetings) {
				var show_date = new Date(data.meetings[i].startdate).toLocaleString();
				contents = contents + '<tr><td>'+data.meetings[i].name+'</td><td>'+show_date+'</td><td>'+data.meetings[i].status+'</td><td id="'+data.meetings[i].id+'-attendees"></td><td>'+data.meetings[i].frequency+'</td><td><button class="btn btn-info" id="'+data.meetings[i].id+'-edit-button">Edit</button></td><td><button class="btn btn-success" id="'+data.meetings[i].id+'-view-button">View</button></td></tr>';

				self.populateAttendees(data.meetings[i].id);
			}

			$('#meetings-table').find('tbody').html(contents);

			$("[id$=-edit-button]").on('click', function () {
				self.editMeeting(this.id.substring(0,36));
			});
			$("[id$=-view-button]").on('click', function () {
				self.viewMeeting(this.id.substring(0,36));
			});
		});
	};

	self.showMeetingsPage = function () {
		self.populateMeetingsPage();
		self.setPage('meetings-page');
		return false;
	};

	self.updateUser = function () {
		var fields = {
			'action'	: 'updateuser',
			'name'		: $('#profile-name').val(),
			'email'		: $('#profile-email').val(),
			'password'	: $('#profile-password').val(),
			'confirm'	: $('#profile-confirm').val()
		};

		if(fields.password && (fields.password != fields.confirm)) {
			showError('Please confirm your new password.');
			return;
		}

		fields.confirm = '';

		mr_api.action(fields, function (data) {
			if(data.status === 'success') {
				$('#profile-password').val('');
				$('#profile-confirm').val('');
				showSuccess('Your profile has been updated.');
			}
			else {
				console.log(JSON.stringify(data));
				showError('There was a problem updating your profile.');
			}
		});

		return false;
	};

	self.populateProfile = function () {
		mr_api.action({ 'action':'getmyprofile' }, function (data) {
			if(data.status === 'success') {
				$('#profile-name').val(data.name);
				$('#profile-email').val(data.email);
			}
			else {
				showError('Error retrieving user profile.');
			}
		});
	};

	self.showProfile = function () {
		self.populateProfile();
		self.setPage('profile-form');
		return false;
	};

	self.afterLogin = function (show_page) {
		$('#menu-login-link').hide();
		$('#menu-register-link').hide();

		$('#menu-review-link').show();
		$('#menu-create-link').show();

		$('#menu-review-link').on('click', self.showMeetingsPage);
		$('#menu-create-link').on('click', function () { self.clearMeetingForm(); self.showMeetingForm(); });

		$('#menu-profile-link').on('click', self.showProfile);
		$('#menu-profile-link').show();

		$('#menu-logout-link').show();
		
		var hash_id = document.location.hash;

		if(hash_id.length === 37) {
			show_page = 'meeting-view';
			$.cookie(LOAD_COOKIE, hash_id.substring(1,37));
		}
		
		switch(show_page) {
			case 'meetings-page':
				self.showMeetingsPage();
				break;
			case 'meeting-form':
				var meetingid = $.cookie(LOAD_COOKIE);
				if(meetingid) {
					self.editMeeting(meetingid);
				}
				else {
					self.showMeetingForm();
				}
				break;
			case 'meeting-view':
				var meetingid = $.cookie(LOAD_COOKIE);
				self.viewMeeting(meetingid);
				break;
			case 'profile-form':
				self.showProfile();
				break;
			default:
				self.showMeetingsPage();
				break;
		}
	};

	self.checkCookies = function () {
		return { 'userid' : $.cookie(USER_COOKIE), 'token' : $.cookie(TOKEN_COOKIE), 'page' : $.cookie(PAGE_COOKIE), 'name' : $.cookie(NAME_COOKIE) };
	};

	self.setCookies = function (userid, token, name) {
		$.cookie(USER_COOKIE, userid);
		$.cookie(NAME_COOKIE, name);
		$.cookie(TOKEN_COOKIE, token);
		$.cookie(PAGE_COOKIE, current_page);
	};

	self.doLogin = function () {
		$('#login-button').attr('disabled', 'disabled');

		var fields = {
			'action' : 'login',
			'email' : $('#login-email').val(),
			'password' : $('#login-password').val()
		};

		mr_api.action(fields, function (data) {
			$('#login-button').removeAttr('disabled');

			if(data.status === 'error') {
				self.showError('There was a problem: '+data.message);
				return;
			}

			if($('#login-remember').prop('checked')) {
				self.setCookies(data.id, data.token);
			}

			self.afterLogin();
		});
	};

	self.doRegister = function () {
		$('#register-button').attr('disabled', 'disabled');

		var fields = {
			'action' : 'adduser',
			'name'	: $('#register-name').val(),
			'email'	: $('#register-email').val(),
			'password' : $('#register-password').val()
		};

		mr_api.action(fields, function (data) {
			$('#register-button').removeAttr('disabled');

			if(data.status === 'error') {
				self.showError('There was a problem: '+data.message);
				return;
			}

			self.showLoginForm();
			self.showSuccess("<strong>Awesome!</strong> You're registered and ready to rock!");
		});

		return false;
	};

	$(document).ready(function () {
		$("#menu-login-link").on('click', self.showLoginForm);
		$("#menu-register-link").on('click', self.showRegisterForm);
		$("#menu-logout-link").on('click', function () { 
			self.showLoginForm();
			$('#menu-login-link').show();
			$('#menu-register-link').show();
			$('#menu-review-link').hide();
			$('#menu-create-link').hide();
			$('#menu-profile-link').hide();
			$('#menu-logout-link').hide();
		});
		
		$("#login-button").on('click', self.doLogin);
		$("#register-button").on('click', self.doRegister);
		$("#profile-button").on('click', self.updateUser);

		$("#register-button").attr('disabled', 'disabled');
		$("#register-form").find('input').change(function () {
			if($("#register-name").val() != '' && $("#register-email").val() != '' && $("#register-password").val() != '' &&  $("#register-confirm").val() === $("#register-password").val()) {
				$("#register-button").removeAttr('disabled');
			}
			else {
				$("#register-button").attr('disabled', 'disabled');
			}
		});

		var cookies = self.checkCookies();

		if(cookies.userid && cookies.token) {
			mr_api.userid = cookies.userid;
			mr_api.token = cookies.token;
			mr_api.name = cookies.name;

			self.afterLogin(cookies.page);
		}
		else {
			self.showLoginForm();
		}
	});

	return self;
})();
