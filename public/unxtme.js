$(function() {
	var cached_options = {
		unix_time: ""
		, format: "ddd MMM D, YYYY h:mm:ss a"
		, unix_format: "seconds"
		, time_zone: "local"
		, tz_info: null
	};
	var hide_human_display = function() {
		$("div.human_output").text("");
	};
	var update_human_display = function(options) {
		options = _.extend(cached_options, options);
		if(_.all(["unix_time", "format", "unix_format", "time_zone", "tz_info"], function(prop) {
				return _.has(options, prop);
			})) {
			var unix_time = parseFloat(options.unix_time);

			if(_.isNaN(unix_time)) {
				hide_human_display();
				return;
			}

			if(options.unix_format === "seconds") {
				unix_time *= 1000;
			}

			if(options.time_zone === "utc") {
				unix_time += moment().zone() * 60 * 1000;
			} else if(options.time_zone === "city") {
				if(_.isNull(options.tz_info)) {
					hide_human_display();
					return;
				} else {
					unix_time += moment().zone() * 60 * 1000;
					unix_time -= parseFloat(options.tz_info.time_offset);
				}
			}

			var unix_moment = moment(unix_time);
			var formatted_time = unix_moment.format(options.format)

			$("div.human_output").text(formatted_time);
		} else {
			hide_human_display();
		}
	};

	(function() {
		var unix_format;
		$("input:radio[name=unix_format]").change(function() {
													var value = $(this).val();
													if(unix_format !== value) {
														unix_format = value;
														update_human_display({unix_format: value});
													}
												});
		$("input:radio[name=unix_format]#"+cached_options.unix_format).attr("checked", true).change();
	}());

	(function() {
		var time_zone;
		$("input:radio[name=time_zone]").change(function() {
													var value = $(this).val();
													if(time_zone !== value) {
														time_zone = value;
														update_human_display({time_zone: value});
													}
												});
		$("input:radio[name=time_zone]#"+cached_options.time_zone).attr("checked", true).change();
	}());

	(function() {
		var city_input="";
		var ajax_timeout;
		$("input:radio[name=time_zone]").change(function() {
			if(!$("input:radio[name=time_zone]#city").attr("checked")) {
				$("input#time_location").removeClass("error success pending");
			}
		});
		$("input#time_location") .on("focus", function() {
								$("input:radio[name=time_zone]#city").attr("checked", true).change();
							})
							.keydown(function() {
								_.defer(_.bind(function() {
									$(this).change();
								}, this))
							})
							.change(function() {
								var value = $(this).val();
								if(city_input !== value) {
									city_input = value;
									update_human_display({tz_info: null});
									$("input#time_location").removeClass("error success")
															.addClass("pending");
									window.clearTimeout(ajax_timeout);
									ajax_timeout = window.setTimeout(_.bind(function(value) {
										$.ajax("/tz", {
											data: {
												q: value
											}

											, success: function(data) {
												if(data.status === "error") {
													update_human_display({tz_info: null});
													if($("input:radio[name=time_zone]#city").attr("checked")) {
														$("input#time_location").removeClass("success pending")
																				.addClass("error");
													}
												} else {
													update_human_display({tz_info: data});
													if($("input:radio[name=time_zone]#city").attr("checked")) {
														$("input#time_location").removeClass("error pending")
																				.addClass("success");
													}
												}
											}
											, error: function(data) {
												update_human_display({tz_info: null});
												if($("input:radio[name=time_zone]#city").attr("checked")) {
													$("input#time_location").removeClass("success pending")
																			.addClass("error");
												}
											}
										});
									}, this, value), 500);
								}
							});
		window.setInterval(function() {
			$("input#time_location").change();
		}, 500);
	}());

	(function() {
		var unix_timestamp_input;
		$("input#unix_time").focus()
							.on("mouseup.select", function() {
								_.defer(_.bind(function() {
									$(this).select();
								}, this));
							})
							.keydown(function() {
								_.defer(_.bind(function() {
									$(this).change();
								}, this))
							})
							.change(function() {
								var value = $(this).val();
								if(unix_timestamp_input !== value) {
									unix_timestamp_input = value;
									update_human_display({unix_time: value});
								}
							})
							.change()
							.select();
		window.setInterval(function() {
			$("input#unix_time").change();
		}, 500);
	}());

	(function() {
		var on_human_format_change = function(value) {
			update_human_display({format: value});
		};

		var default_format = cached_options.format;
		var human_format;
		$("input#human_format")	.val(default_format)
								.keydown(function() {
									_.defer(_.bind(function() {
										$(this).change();
									}, this))
								})
								.change(function() {
									var value = $(this).val();
									if(human_format !== value) {
										human_format = value;
										on_human_format_change(value);
									}
								})
								.change();
		window.setInterval(function() {
			$("input#human_format").change();
		}, 500);
	}());
});
