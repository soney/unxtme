$(function() {
	var options = {
			unix_time: Math.round(((new Date()).getTime())/1000.0) 
			, human_time: ""
			, human_format: "dddd, MMMM D YYYY h:mm:ss A"
			, unix_format: "seconds"
			, time_zone: "local"
			, tz_info: null
			, human_time: ""
			, city_input: ""
			, converting_from: "unix"
		},
		cached_tz_values = {};

	$.fn.clickSelected = function() {
		return this.each(function() {
			var $this = $(this);
			$this.on("focus", function() {
				$this.one("mouseup.select", 
						function() {
							_.defer(function() {
								$this.select();
							})
					});

				_.delay(function() {
					$this.off("mouseup.select");
				}, 2000);
			});
		});
	};

	$.fn.addChangeListeners = function() {
		return this.each(function() {
			var $this = $(this);
			var val = $this.val();

			$this.keydown(function() {
				_.defer(function() {
					var new_val = $this.val();
					if(new_val !== val) {
						val = new_val;
						$this.change();
					}
				})
			});

			window.setInterval(function() {
				var new_val = $this.val();
				if(new_val !== val) {
					val = new_val;
					$this.change();
				}
			}, 1000);
		});
	};

	var update_options = function(o) {
		_.extend(options, o);
		update_display();
	};


	var update_display = function() {
		if(options.converting_from === "human") {
			update_unix_display();
		} else {
			update_human_display();
		}
	};

	var hide_human_display = function() {
		$("div.human_time div.output").text("");
	};
	var get_unix_time = function() {
		var unix_time = parseFloat(options.unix_time);
		if(_.isNaN(unix_time) || unix_time < 0) {
			return undefined;
		}

		if(options.unix_format === "seconds") {
			unix_time *= 1000;
		}
		return unix_time;
	};
	var get_timezone_offset = function() {
		var offset = 0;
		if(options.time_zone === "utc") {
			offset += moment().zone() * 60 * 1000;
		} else if(options.time_zone === "city") {
			if(!_.isNull(options.tz_info)) {
				offset += moment().zone() * 60 * 1000;
				offset += parseFloat(options.tz_info.rawOffset + options.tz_info.dstOffset) * 1000;
			}
		}
		return offset;
	};

	var tz_info_pending = function() {
		return options.time_zone === "city" && _.isNull(options.tz_info);
	};

	var update_human_display = function() {
		var unix_time = get_unix_time();

		if(_.isUndefined(unix_time)) {
			$("input#unix_time").addClass("error");
			hide_human_display();
			return;
		} else {
			$("input#unix_time").removeClass("error");
		}

		if(tz_info_pending()) {
			hide_human_display();
			return;
		}
		var offset = get_timezone_offset();
		unix_time += offset;

		var unix_moment = moment(unix_time);
		var formatted_time = unix_moment.format(options.human_format)

		$("div.human_time div.output").text(formatted_time);
	};

	var hide_unix_display = function() {
		$("div.unix_time div.output").text("");
	};
	var get_human_time = function() {
		var parsed_time = moment(options.human_time, options.human_format),
			val = x.valueOf();
		if(_.isNaN(val)) {
			parsed_time = moment(options.human_time); // remove formatting setting
			val = x.valueOf();
			return val || undefined;
		} else {
			return val;
		}
	};

	var update_unix_display = function() {
		var unix_time = get_human_time();
		if(unix_time === undefined) {
			hide_unix_display();
			$("inpu.t#human_time").addClass("error");
			return;
		} else {
			$("input#human_time").removeClass("error");
		}

		if(tz_info_pending()) {
			hide_unix_display();
			return;
		}

		var offset = get_timezone_offset();
		unix_time -= offset;

		if(options.unix_format === "seconds") {
			unix_time = Math.round(unix_time/1000.0);
		}
		$("div.unix_time div.output").text(unix_time);
	};


	(function() {
		var ajax_timeout;
		$("input:radio[name=time_zone]").change(function() {
			if(!$("input:radio[name=time_zone]#city").attr("checked")) {
				$("input#time_location").removeClass("error success pending");
			}
		});
		$("input#time_location")	.on("focus", function() {
										if(!$("input:radio[name=time_zone]#city").attr("checked")) {
											$("input:radio[name=time_zone]#city").attr("checked", true).change();
										}
									})
									.clickSelected()
									.addChangeListeners()
									.val(options.city_input);
		var tv, ci = options.city_input;

		$("input#time_location,input#unix_time,input#human_time,input:radio[name=time_zone]").change(function() {
										if($("input:radio[name=time_zone]#city").is(":checked")) {
											var tval;
											if(options.converting_from === "unix") {
												tval = get_unix_time();
											} else {
												tval = get_human_time();
											}
											var city_input = $("input#time_location").val();

											if(tv === tval && city_input === ci) {
												return;
											} else {
												tv = tval;
												ci = city_input;
											}

											update_options({tz_info: null, city_input: city_input});
											$("input#time_location").removeClass("error success")
																	.addClass("pending");
											$("div.time_location_details").text("");
											window.clearTimeout(ajax_timeout);
											var on_data = function(data) {
												if(data.status === "error") {
													update_options({tz_info: null, city_input: city_input});
													if($("input:radio[name=time_zone]#city").attr("checked")) {
														$("input#time_location").removeClass("success pending")
																				.addClass("error");
													}
												} else {
													update_options({tz_info: data, city_input: city_input});
													if($("input:radio[name=time_zone]#city").attr("checked")) {
														$("input#time_location").removeClass("error pending")
																				.addClass("success");
														var offset= -0.1*Math.round(10*(data.rawOffset + data.dstOffset)/3600);
														var offset_str;
														if(offset> 0) { offset_str = "+" + offset; }
														else { offset_str = String(offset); }
														$("div.time_location_details").text(data.timeZoneId + " (" + data.timeZoneName + ", UTC" + offset_str + ")");

														_.delay(function() {
															$("input#time_location").removeClass("success");
														}, 2000);
													}
												}
											};
											ajax_timeout = window.setTimeout(_.bind(function(city_input, tval) {
												get_timezone(city_input, tval/1000, function(err, tz_info) {
													if(!err) {
														on_data(tz_info);
													}
												});
											}, this, city_input, tval), 500);
										}
							});
	}());

	$("input:radio[name=unix_format]").change(function() {
												var value = $(this).val();
												update_options({unix_format: value});
											});
	$("input:radio[name=unix_format]#"+options.unix_format).attr("checked", true).change();

	$("input:radio[name=time_zone]").change(function() {
												var value = $(this).val();
												update_options({time_zone: value});
											});
	$("input:radio[name=time_zone]#"+options.time_zone).attr("checked", true).change();


	$("input#unix_time")	.focus()
							.clickSelected()
							.addChangeListeners()
							.change(function() {
								var value = $(this).val();
								update_options({unix_time: value});
							})
							.val(options.unix_time)
							.change();

	$("input#human_format")	.val(options.human_format)
							.addChangeListeners()
							.change(function() {
								var value = $(this).val();
								update_options({human_format: value});
							})
							.change();

	$("input#human_time")	.val(options.human_format)
							.clickSelected()
							.addChangeListeners()
							.change(function() {
								var value = $(this).val();
								update_options({human_time: value});
							})
							.change();


	$("a#swap").click(function() {
		if(options.converting_from === "unix") {
			$("div.human_time div.input input")	.val($("div.human_time div.output").text())
												.change();
			options.converting_from = "human";
		} else {
			$("div.unix_time div.input input")	.val($("div.unix_time div.output").text())
												.change();
			options.converting_from = "unix";
		}
		update_converting();
	});

	var update_converting = function() {
		if(options.converting_from === "unix") {
			$("#swap .swap_horizontal .glyphicon").removeClass("glyphicon-arrow-left").addClass("glyphicon-arrow-right");
			$("#swap .swap_vertical .glyphicon").removeClass("glyphicon-arrow-up").addClass("glyphicon-arrow-down");

			$("div.unix_time div.input").show();
			$("div.unix_time div.output").hide();
			$("div.human_time div.input").hide();
			$("div.human_time div.output").show();

			//$("input#human_format").attr("disabled", false);
		} else {
			$("#swap .swap_horizontal .glyphicon").removeClass("glyphicon-arrow-right").addClass("glyphicon-arrow-left");
			$("#swap .swap_vertical .glyphicon").removeClass("glyphicon-arrow-down").addClass("glyphicon-arrow-up");

			$("div.unix_time div.input").hide();
			$("div.unix_time div.output").show();
			$("div.human_time div.input").show();
			$("div.human_time div.output").hide();
			
			//$("input#human_format").attr("disabled", true);
		}
		$("div.input:visible input").focus().select();
		update_display();
	};
	update_converting();


	$("div.input:visible input").focus().select();

	var cached_lat_long = {},
		cached_offsets = {},
		getLatLong = function(city_name, callback, thisArg) {
			if(!thisArg) { thisArg = this; }

			if(_.has(cached_lat_long, city_name)) {
				callback.apply(thisArg, cached_lat_long[city_name]);
			} else {
				$.ajax({
					url: "//maps.googleapis.com/maps/api/geocode/json",
					data: {
						address: city_name,
						sensor: false
					},
					success: function(data) {
						if(data.status === "OK") {
							var results = data.results,
								result = results[0];

							cached_lat_long[city_name] = [false, result];
						} else {
							cached_lat_long[city_name] = [data];
						}
					},
					error: function(err) {
						cached_lat_long[city_name] = [err];
					}
				}).always(function() {
					callback.apply(thisArg, cached_lat_long[city_name]);
				});
			}
		},
		getTZOffset = function(lat, lng, timestamp, callback, thisArg) {
			var hash = [lat,lng,timestamp].join(",");

			if(!thisArg) { thisArg = this; }

			if(_.has(cached_offsets, hash)) {
				callback.apply(thisArg, cached_offsets[hash]);
			} else {
				$.ajax({
					url: "https://maps.googleapis.com/maps/api/timezone/json",
					data: {
						location: [lat, lng].join(","),
						sensor: false,
						timestamp: Math.round(timestamp),
						key: "AIzaSyC7cNKMxQv5FetedXxXVyyEa7mkHrtot5w"
					},
					success: function(data) {
						if(data.status === "OK") {
							cached_offsets[hash] = [false, data];
						} else {
							cached_offsets[hash] = [data];
						}
					},
					error: function(data) {
						cached_offsets[hash] = [err];
					}
				}).always(function() {
					callback.apply(thisArg, cached_offsets[hash]);
				});
			}
		},
		get_timezone = function(city_name, timestamp, callback) {
			getLatLong(city_name, function(err, result) {
				if(err) {
					callback(err);
				} else {
					var lat = result.geometry.location.lat,
						lng = result.geometry.location.lng;

					if(!_.isNumber(timestamp)) {
						timestamp = (new Date()).getTime()/1000;
					}

					getTZOffset(lat, lng, timestamp, function(err, data) {
						if(err) {
							callback(err);
						} else {
							callback(false, data);
						}
					});
				}
			});
		};
});
