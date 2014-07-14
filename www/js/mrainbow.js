
var mrainbow = angular.module('mrainbow', [ 'ngRoute', 'ngAnimate', 'ngCookies', 'ui.bootstrap', 'xeditable' ]);

mrainbow.config(function ($routeProvider, $locationProvider) {
	$routeProvider
	.when('/', { templateUrl: '/views/default.html', controller: 'defaultController' })
	.when('/login', { templateUrl: '/views/login.html', controller: 'loginController' })
	.when('/list', { templateUrl: '/views/list.html', controller: 'listController' })
	.when('/logout', { templateUrl: '/views/login.html', controller: 'logoutController' })
	.when('/view/:meetingId', { templateUrl: '/views/view.html', controller: 'viewController' })
	.otherwise({ redirectTo: '/' });
})
.run(function (editableOptions) {
	editableOptions.theme = 'bs3';
})
.filter('orderObjectBy', function() {
	return function(items, field, reverse) {
		var filtered = [];
		angular.forEach(items, function(item) {
			filtered.push(item);
		});
		filtered.sort(function (a, b) {
			return (a[field] > b[field] ? 1 : -1);
		});
		if(reverse) filtered.reverse();
		return filtered;
	};
})
.factory('mrApi', function ($http, $cookieStore, mrSocket) {
	var url = '/api/',
		request = {},
		factory = {};

	factory.action = function (fields) {
		fields.userid = $cookieStore.get('userid');
		fields.token = $cookieStore.get('token');

		if(fields.password) { fields.password = md5(fields.password); }

		console.log('Query params: '+JSON.stringify(fields));

		request = {
			method: 'post',
			url: url,
			params: fields
		};

		return $http(request);
	};

	factory.userid = $cookieStore.get('userid');
	//factory.token = $cookieStore.get('token');

	return factory;
})
.factory('mrSocket', function ($q, $rootScope, $cookieStore, alertService) {
	var Service = {},
		callbacks = {},
		currentCallbackId = 0,
		socketData = {},
		ws = new WebSocket('ws://localhost:8181/');


	function sendRequest (request) {
		if(ws.readyState === 0) {
			setTimeout(sendRequest, 1000, request);
			return;
		}

		var defer = $q.defer();
		var callbackId = getCallbackId();
		callbacks[callbackId] = {
			time: new Date(),
			cb: defer
		};
		if(Service.token && !request.token) { request.token = Service.token; }
		if(Service.userid && !request.userid) { request.userid = Service.userid; }
		request.callback_id = callbackId;
		console.log('Sending request', request);
		ws.send(JSON.stringify(request));
		return defer.promise;
	}

	Service.action = function (message) {
		if(message.password) {
			message.password = md5(message.password);
		}
		return sendRequest(message);
	};

	ws.onopen = function () {
		console.log("Socket has been opened!");

		if(Service.userid && Service.token) {
			Service.action({ action:'reestablish', userid:Service.userid, token:Service.token }).success(function (data, status) {
				if(data.status === 'success') {
					console.log('Socket connection re-established!');
				}
				else {
					console.log('Unable to re-establish socket connection, need to log in again. :(');
				}
			}).error(function (data, status) {
				console.log('Unable to re-establish socket connection, failed to even get a proper response.');
			});
		}

	};

	ws.onmessage = function (message) {
		listener(JSON.parse(message.data));
	};

	function listener (data) {
		var messageObj = data;
		console.log("Received data from websocket: ", messageObj);

		if(messageObj.status === 'error' && messageObj.message.match(/^Unauthorized access attempt.*/)) {
			console.log('Websocket connection was lost. :(');
			alertService.add('warning', 'Websocket connection lost. Please logout and login to resolve.');
		}
		
		if(messageObj.token) {
			Service.token = messageObj.token;
			$cookieStore.put('sockettoken', messageObj.token);
		}

		if(callbacks.hasOwnProperty(messageObj.action)) {
			console.log('Found callback for action == '+messageObj.action);
			$rootScope.$apply(callbacks[messageObj.action].callback(messageObj));
		}
		else if(callbacks.hasOwnProperty(messageObj.callback_id)) {
			console.log(callbacks[messageObj.callback_id]);
			$rootScope.$apply(callbacks[messageObj.callback_id].cb.resolve(messageObj.data));
			delete callbacks[messageObj.callback_id];
		}
	}

	function getCallbackId () {
		currentCallbackId += 1;
		if(currentCallbackId > 10000) {
			currentCallbackId = 0;
		}
		return currentCallbackId;
	}

	Service.userid = $cookieStore.get('userid');
	Service.token = $cookieStore.get('sockettoken');


	Service.viewMeeting = function (meetingid) {
		socketData.meetingid = meetingid;
		return sendRequest({ action:'viewmeeting', id:meetingid });
	};

	Service.leaveMeeting = function () {
		var promise = sendRequest({ action:'leavemeeting', id:socketData.meetingid });
		socketData.meetingid = '';
		return promise;
	};

	Service.addItem = function (fields) {
		fields.action = 'additem';
		return sendRequest(fields);
	};

	Service.updateItem = function (fields) {
		fields.action = 'updateitem';
		return sendRequest(fields);
	};

	Service.deleteItem = function (fields) {
		fields.action = 'deleteitem';
		return sendRequest(fields);
	};

	Service.addMinutes = function (fields) {
		fields.action = 'addminutes';
		return sendRequest(fields);
	};

	Service.updateMinutes = function (fields) {
		fields.action = 'updateminutes';
		return sendRequest(fields);
	};

	Service.registerCallback = function (action, cb) {
		callbacks[action] = {};
		callbacks[action].callback = cb;
	};

	return Service;
})
.factory('alertService', function ($rootScope) {
	var alertService = {};

	$rootScope.alerts = [];

	alertService.closeAlertIdx = function (index) {
		$rootScope.alerts.splice(index, 1);
	};

	alertService.closeAlert = function (alert) {
		alertService.closeAlertIdx($rootScope.alerts.indexOf(alert));
	};
	
	alertService.add = function (type, msg) {
		$rootScope.alerts.push({ type: type, msg: msg, close: function () { alertService.closeAlert(this); } });
	};

	return alertService;
})
.controller('navController', function ($scope, $location, $routeParams, $cookieStore) {
	$scope.isActive = function (viewLocation) {
		return viewLocation === $location.path();
	};

	$scope.loggedIn = function () {
		var token = $cookieStore.get('token');

		if(token) { return true; }

		return false;
	};
})
.controller('defaultController', function ($scope, $location, $routeParams, $cookieStore) {
	var token = $cookieStore.get('token');

	if(token) {
		$location.url('/list');
	}
	else {
		$location.url('/login');
	}
})
.controller('loginController', function ($scope, $cookieStore, $location, mrApi, mrSocket, alertService) {
	$cookieStore.put('userid', '');
	$cookieStore.put('token', '');
	$cookieStore.put('sockettoken', '');

	$scope.loginForm = function () {
		if($scope.loginEmail && $scope.loginPassword) {
			mrApi.action({ action:'login', email:$scope.loginEmail, password:$scope.loginPassword }).success(function (data, status) {
				console.log('SUCCESS: '+JSON.stringify(data));
				if(data.status === 'success') {
					$cookieStore.put('userid', data.id);
					$cookieStore.put('token', data.token);

					mrSocket.action({ action:'login', email:$scope.loginEmail, password:$scope.loginPassword });

					alertService.add('success', 'Login successful.');
					$location.url('/list');
				}
				else {
					$scope.loginEmail = '';
					$scope.loginPassword = '';
					alertService.add('danger', 'Login failed. Email and/or password incorrect.');
				}
			}).error(function (data, status) { 
				console.log('ERROR data: '+JSON.stringify(data)+' status: '+JSON.stringify(status)); 
				alertService.add('danger', 'Error contacting API');
			});
		}
		else {
			console.log('loginForm called with no loginEmail or loginPassword.');
		}
	};
})
.controller('logoutController', function ($scope, $cookieStore, $location, $routeParams, mrApi, alertService) {
	$cookieStore.put('userid', '');
	$cookieStore.put('token', '');
	$cookieStore.put('sockettoken', '');

	alertService.add('success', 'You have been logged out.');
	$location.url('/login');
})
.controller('listController', function ($scope, $location, $routeParams, mrApi, alertService) {
	mrApi.action({ action:'getmeetings' }).success(function (data, status) {
		if(data.status === 'success') {
			$scope.meetings = data.meetings;

			$scope.showMeetings = [];

			$scope.meetings.forEach(function (element, index, array) {
				mrApi.action({ action:'getattendees', meetingid: element.id }).success(function (data, status) {
					if(data.status === 'success') {
						element.attendees = data.attendees;
					}
					else {
						console.log('listController: getattendees for meetingid: '+element.id+' returned error: '+JSON.stringify(data));
					}
				}).error(function (data, status) {
					console.log('listController: Error contacting API for getattendees.');
				});

				if(!element.nextid) {
					$scope.showMeetings.push(element);
				}
			});
		}
		else {
			alertService.add('danger', 'Unable to retrieve meeting list.');
			$location.url('/logout');
		}
	}).error(function (data, status) {
		alertService.add('danger', 'Error contacting API for getmeetings.');
	});

	$scope.swapMeeting = function (swapIndex, swapId) {
		//console.log('swapMeeting called with index = '+swapIndex+' and swapId = '+swapId);
		$scope.meetings.forEach(function (element, index, array) {
			if(element.id === swapId) {
				$scope.showMeetings[swapIndex] = element;
			}
		});
	};
})
.controller('viewController', function ($scope, $location, $routeParams, mrApi, mrSocket, alertService) {
	var meetingid = $routeParams.meetingId;

	if(!meetingid) {
		alertService.add('warning', 'No meeting id specified. Returning to list.');
		$location.url('/list');
	}

	$scope.inviteEmail = '';

	$scope.collapseAttendees = true;

	if($scope.users === undefined) {
		$scope.users = {};
	}

	$scope.toggleAttendees = function () {
		$scope.collapseAttendees = !$scope.collapseAttendees;
	};

	$scope.loadMinutes = function () {
		var subs = {},
			supers = {};

		mrApi.action({ action:'getminutes', meetingid:meetingid }).success(function (data, status) {
			if(data.status === 'success' && data.minutes != undefined) {
				$scope.meeting.items.forEach(function (item, itemIndex) {
					item.minutes = [];
					if(item.superid) {
						if(subs[item.superid] === undefined) {
							subs[item.superid] = {};
						}
						subs[item.superid][item.id] = item;
					}
					else {
						supers[item.id] = item;
					}

					data.minutes.forEach(function (minutes, minutesIndex) {
						if(item.id === minutes.itemid) {
							if($scope.users[minutes.userid] === undefined) {
								mrApi.action({ action:'getuser', id:minutes.userid }).success(function (data, status) {
									minutes.username = data.name;
									$scope.users[minutes.userid] = data;
									//$scope.meeting.items[itemIndex].minutes = [ minutes ];
									if(item.superid) {
										subs[item.superid][item.id].minutes = [ minutes ];
									}
									else {
										supers[item.id].minutes = [ minutes ];
									}
								});
							}
							else {
								minutes.username = $scope.users[minutes.userid].name;
								//$scope.meeting.items[itemIndex].minutes = [ minutes ];
								if(item.superid) {
									subs[item.superid][item.id].minutes = [ minutes ];
								}
								else {
									supers[item.id].minutes.push = [ minutes ];
								}
							}
						}
					});
				});

				$scope.meeting.subs = subs;
				$scope.meeting.supers = supers;
			}
		});
	};

	$scope.loadAttendees = function () {
		$scope.users = {};
		if($scope.meeting.attendees == undefined) {
			return mrApi.action({ action:'getattendees', meetingid:meetingid }).success(function (data, status) {
				if(data.status === 'success') {
					$scope.meeting.attendees = data.attendees;
					for(var i in data.attendees) {
						$scope.users[data.attendees[i].attendeeid] = { id:data.attendees[i].attendeeid, name:data.attendees[i].name };
					}
				}
			});
		}
		else {
			return null;
		}
	};


	mrApi.action({ action:'getmeetings', id:meetingid }).success(function (data, status) {
		$scope.meeting = {};

		if(data.status === 'success') {
			$scope.meeting = data.meetings[0];

			mrSocket.viewMeeting(data.meetings[0].id);

			var loadMinutes = 
			mrApi.action({ action:'getitems', meetingid:meetingid }).success(function (data, status) {
				if(data.status === 'success') {
					$scope.meeting.items = data.items;

					$scope.meeting.items.forEach(function (element, index, array) {
						if($scope.users[element.ownerid] === undefined) {
							mrApi.action({ action:'getuser', id:element.ownerid }).success(function (data, status) {
								if(data.status === 'success') {
									element.ownername = data.name;
									$scope.users[data.id] = data;
									$scope.loadMinutes();
									$scope.loadAttendees();
								}
							});
						}
						else {
							element.ownername = $scope.users[element.ownerid].name;
						}
					});
				}
			});

		}
		else {
			alertService.add('danger', 'Unable to load meeting.');
			$location.url('/logout');
		}
	});

	$scope.updateItem = function (item, fieldname, $data) {
		item[fieldname] = $data;
		if(fieldname === 'ownername') {
			for(user in $scope.users) {
				if(user.name === $data) {
					item.ownerid = user.id;
				}
			}
		}
		mrApi.action({ action:'updateitem', id:item.id, name:item.name, ownerid:item.ownerid, sortorder:item.sortorder })
		.success(function (data, status) {
			console.log(data);
			if(data.status === 'success') {
				mrSocket.updateItem(data);
			}
		});

		return true;
	};

	mrSocket.registerCallback('updateitem', function (data) {
		console.log('ownerid = '+data.ownerid+' users = '+JSON.stringify($scope.users));
		data.ownername = $scope.users[data.ownerid].name;

		if(data.superid) {
			$scope.meeting.subs[data.superid][data.id] = data;
		}
		else {
			$scope.meeting.supers[data.id] = data;
		}

		$scope.meeting.items.forEach(function (item) {
			if(item.id === data.id) {
				item == data;
				return;
			}
		});
	});

	$scope.addItem = function (superId) {
		var itemName = 'New item',
			sortOrder = 0,
			sortItems = $scope.meeting.supers;

		if(superId) {
			sortItems = $scope.meeting.subs[superId];
		}
	
		for(var i in sortItems) {
			if(sortItems[i].sortorder > sortOrder) {
				sortOrder = sortItems[i].sortorder;
			}
		}

		mrApi.action({ action: 'additem', meetingid: $scope.meeting.id, name: itemName, sortorder: sortOrder, superid: superId }).success(function (data, status) {
			if(data.status === 'success') {
				data.minutes = [];
				data.ownername = $scope.users[data.ownerid].name;

				if(data.superid) {
					if($scope.meeting.subs[superId] === undefined) {
						$scope.meeting.subs[superId] = {};
					}
					$scope.meeting.subs[superId][data.id]  = data;
				}
				else {
					$scope.meeting.supers[data.id] = data;
				}
				console.log('New item added.');

				mrSocket.addItem(data);
			}
			else {
				alertService.add('Unable to store new item.');
			}
		});
	};

	mrSocket.registerCallback('additem', function (data) {
		if(data.superid) {
			$scope.meeting.subs[data.superid][data.id] = data;
		}
		else {
			$scope.meeting.supers[data.id] = data;
		}

		$scope.meeting.items.push(data);
	});
			

	$scope.updateMinutes = function (item, minutesIndex, $data) {
		mrApi.action({ action:'updateminutes', id:item.minutes[minutesIndex].id, content:$data }).success(function (data, status) {
			if(data.status === 'success') {
				mrSocket.updateMinutes({ itemid:item.id, id:item.minutes[minutesIndex].id, content:$data });
			}
		});
	};

	mrSocket.registerCallback('updateminutes', function (data) {
		var minutes = [];

		if(data.itemid && data.content) {
			$scope.meeting.items.forEach(function (element) {

				if(element.id === data.itemid) {
					if(element.superid) {
						minutes = $scope.meeting.subs[element.superid][data.itemid].minutes;
					}
					else {
						minutes = $scope.meeting.supers[data.itemid].minutes;
					}

					if(minutes === undefined) {
						console.log("Tried to update minutes that do not exist? itemid = "+data.itemid+" minutesid = "+data.id);
					}
					else {
						minutes.forEach(function (ele, index) {
							if(ele.id === data.id) {

								if(element.superid) {
									$scope.meeting.subs[element.superid][data.itemid].minutes[index].content = data.content;
								}
								else {
									$scope.meeting.supers[data.itemid].minutes[index].content = data.content;
								}
							}
						});
					}
				}
			});

		}
	});

	$scope.addMinutes = function (item) {
		var newContent = 'New minutes.';

		console.log('addMinutes called with item = '+JSON.stringify(item));

		mrApi.action({ action:'addminutes', itemid: item.id, content: newContent }).success(function (data, status) {
			if(data.status === 'success') {
				console.log('New minutes added.');
				data.username = $scope.users[data.userid].name;
				item.minutes.push(data);
				mrSocket.addMinutes({ itemid:item.id, minutes:data });
			}
			else {
				console.log('Add minutes returned error: '+JSON.stringify(data));
				alertService.add('danger', 'Unable to store new minutes.');
			}
		});
	};

	mrSocket.registerCallback('addminutes', function (data) {
		if(data.itemid && data.minutes) {
			$scope.meeting.items.forEach(function (element) {
				if(element.id === data.itemid) {
					if(element.superid) {
						if($scope.meeting.subs[element.superid][data.itemid].minutes === undefined) {
							$scope.meeting.subs[element.superid][data.itemid].minutes = [];
						}
						$scope.meeting.subs[element.superid][data.itemid].minutes.push(data.minutes);
					}
					else {
						if($scope.meeting.supers[data.itemid].minutes === undefined) {
							$scope.meeting.supers[data.itemid].minutes = [];
						}
						$scope.meeting.supers[data.itemid].minutes.push(data.minutes);
					}
				}
			});
		}
	});

	$scope.showHistory = function (item) {
		mrApi.action({ action:'getminutes', meetingid:$scope.meeting.lastid }).success(function (data, status) {
			if(data.status === 'success') {
				data.minutes.forEach(function (element, index) {
					if(element.itemid === item.lastid) {
						element.username = $scope.users[element.userid].name;
						item.minutes.unshift(element);
					}
				});
			}
		});
	};

	$scope.dismissHistory = function (minutesIndex, minutes) {
		minutes.splice(minutesIndex, 1);
	};

	$scope.deleteItem = function (item, itemIndex) {
		mrApi.action({ action:'deleteitem', id:item.id }).success(function (data, status) {
			if(data.status === 'success') {
				if(item.superid) {
					delete $scope.meeting.subs[item.superid][item.id];
					for(var i in $scope.meeting.items) {
						if($scope.meeting.items[i].id === item.id) {
							$scope.meeting.items.splice(i, 1);
						}
					}
				}
				else {
					$scope.meeting.items.splice(itemIndex, 1);
					delete $scope.meeting.supers[item.id];
				}
			}
			mrSocket.deleteItem({ id: item.id });
		});
	};

	mrSocket.registerCallback('deleteitem', function (data) {
		if(data.id) {
			if(item.superid) {
				delete $scope.meeting.subs[item.superid][item.id];
				for(var i in $scope.meeting.items) {
					if($scope.meeting.items[i].id === item.id) {
						$scope.meeting.items.splice(i, 1);
					}
				}
			}
			else {
				$scope.meeting.items.splice(itemIndex, 1);
				delete $scope.meeting.supers[item.id];
			}
		}
	});

	$scope.sendInvite = function (inviteEmail) {
		var user = {};

		return mrApi.action({ action:'getuser', email: inviteEmail }).success(function (data, status) {
			if(data.status === 'success') {
				if(data.id) {
					user = data;
					mrApi.action({ action:'addattendee', attendeeid:user.id, meetingid: $scope.meeting.id }).success(function (data, status) {
						if(data.status === 'success') {
							$scope.meeting.attendees.push(user);
							alertService.add('success', 'Attendee added.');
						}
						else {
							alertService.add('danger', 'Unable to add attendee.');
						}
					});
				}
				else {
					user.temppass = Math.random().toString(36).slice(-8);
					user.name = inviteEmail.substr(0, inviteEmail.indexOf('@'));
					user.invite = $scope.users[mrApi.userid].name;

					console.log('user = '+JSON.stringify(user));

					mrApi.action({ action:'adduser', name:user.name, email:inviteEmail, password:user.temppass, temppass:user.temppass, invite:user.invite }).success(function (data, status) {
						if(data.status === 'success') {
							user = data;
							if(user.id) {
								mrApi.action({ action:'addattendee', attendeeid:user.id, meetingid: $scope.meeting.id }).success(function (data, status) {
									if(data.status === 'success') {
										$scope.meeting.attendees.push(user);
										alertService.add('success', 'User created and attendee added.');
									}
									else {
										alertService.add('danger', 'Unable to add attendee, but user created.');
									}
								});
							}
						}
						else {
							alertService.add('danger', 'User does not exist, and unable to create user.');
						}
					});
				}
			}
		});
	};
});

