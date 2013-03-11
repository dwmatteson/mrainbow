
var mr_api = (function () {
	var	self = this,
		api_address = '//meetingrainbow.com/api/';

	self.userid = '';
	self.token = '';
	self.name = '';

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
			}

			cb(data);
		});
	};

	return self;
})();
