var express = require("express");
var http = require("http");
var querystring = require("querystring");
var time = require("time");

var app = express.createServer();
var cached_askgeo_responses = {};
app.get("/tz", function(req, response, next) {
	var respond = function(d) {
		response.writeHead(200, {'content-type': 'text/json' });
		response.write(JSON.stringify(d));
		response.end("\n")
	};
	var query = req.query.q;
	var t = parseFloat(req.query.t);
	var q_date = new time.Date(t);

	if(cached_askgeo_responses.hasOwnProperty(query)) {
		var new_response = {};
		var cached_response = cached_askgeo_responses[query];

		for(key in cached_response) {
			if(cached_response.hasOwnProperty(key)) {
				new_response[key] = cached_response[key];
			}
		}
		q_date.setTimezone(cached_response.timezone);
		new_response["timezoneAbbr"] = q_date.getTimezoneAbbr();
		new_response["timezoneOffset"] = q_date.getTimezoneOffset();
		respond(new_response);
		return;
	}

	http.get({
		host: "maps.googleapis.com"
		, port: 80
		, path: "/maps/api/geocode/json?" + querystring.stringify({
			address: query
			, sensor: false
		})
	}, function(res) {
		var gData = "";
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
		  gData += chunk;
		});

		res.on('end', function(){
			var google_response = JSON.parse(gData);
			if(google_response.results.length === 0) {
				respond({status: "error", type: "noloc"});
				return;
			}
			var formatted_address = google_response.results[0].formatted_address;
			var lat = google_response.results[0].geometry.location.lat;
			var lng = google_response.results[0].geometry.location.lng;

			http.get({
				host: "www.askgeo.com"
				, port: 80
				, path: "/api/1010025/pbdiiur0eqegh22sj9cu2dklh0/timezone.json?" + querystring.stringify({
					points: lat+","+lng
				})
			}, function(res) {
				var askData = "";
				res.on('data', function (chunk) {
				  askData += chunk;
				});
				res.on('end', function() {
					var askgeo_response = JSON.parse(askData);
					if(askgeo_response.code !== 0) {
						respond({status: "error", type: "askgeo"});
						return;
					}

					var timezone = askgeo_response.data[0].timeZone;
					var timezone_name = askgeo_response.data[0].windowsStandardName;

					var askgeo_response = {
						status: "ok"
						, formatted_address: formatted_address
						, timezone: timezone
					};
					cached_askgeo_responses[query] = askgeo_response;

					var new_response = {};

					for(key in askgeo_response) {
						if(askgeo_response.hasOwnProperty(key)) {
							new_response[key] = askgeo_response[key];
						}
					}
					q_date.setTimezone(askgeo_response.timezone);
					new_response["timezoneAbbr"] = q_date.getTimezoneAbbr();
					new_response["timezoneOffset"] = q_date.getTimezoneOffset();
					respond(new_response);
				});
			}, function(res) {
				respond({status: "error", type: "askgeo_ajax"});
			});
		});
	}, function(res) {
		respond({status: "error", type: "google_ajax"});
	});
});
app.use(express.static(__dirname + '/public'));

var port = process.env.PORT || 8000;
app.listen(port, function() {
	console.log("Listening on " + port);
});
