var express = require("express");
var http = require("http");
var querystring = require("querystring");

var app = express.createServer();
app.get("/tz", function(req, response, next) {
	var respond = function(d) {
		response.writeHead(200, {'content-type': 'text/json' });
		response.write(JSON.stringify(d));
		response.end("\n")
	};
	var query = req.query.q;
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
				if(res.code !== 0) {
					respond({status: "error", type: "askgeo"});
					return;
				}
				var askData = "";
				res.on('data', function (chunk) {
				  askData += chunk;
				});
				res.on('end', function() {
					var askgeo_response = JSON.parse(askData);

					var timezone = askgeo_response.data[0].timeZone;
					var time_offset = askgeo_response.data[0].currentOffsetMs;
					var timezone_name = askgeo_response.data[0].windowsStandardName;

					respond({
						status: "ok"
						, formatted_addres: formatted_address
						, timezone: timezone
						, time_offset: time_offset
						, timezone_name: timezone_name
					});
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


