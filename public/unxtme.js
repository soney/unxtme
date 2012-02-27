$(function() {
	var converting_from = "unix";
	var cached_options = {
		unix_time: Math.round(((new Date()).getTime())/1000.0) 
		, human_time: ""
		, format: "dddd, MMMM D YYYY h:mm:ss A"
		, unix_format: "seconds"
		, time_zone: "local"
		, tz_info: null
		, human_time: ""
		, city_input: ""
	};

	var save_state = function() { };
	if(_.has(window, "localStorage")) {
		var stringified_state = localStorage.getItem("state");
		if(stringified_state) {
			var saved_state = JSON.parse(stringified_state);
			/*
			converting_from = saved_state.converting_from;
			_.extend(cached_options, saved_state.cached_options);
			*/
		}

		var serialize_state = function() {
			return {
				converting_from: converting_from
				, cached_options: cached_options
			};
		};

		var stringify_state = function() {
			return JSON.stringify(serialize_state());
		};
		save_state = function() {
			localStorage.setItem("state", stringify_state());
		};
	}


	var update_display = function(options) {
		options = _.extend(cached_options, options);
		if(converting_from === "human") {
			update_unix_display(options);
		} else {
			update_human_display(options);
		}
		save_state();
	};

	var hide_human_display = function() {
		$("div.human_time div.output").text("");
	};
	var update_human_display = function(options) {
		if(_.all(["unix_time", "format", "unix_format", "time_zone", "tz_info"], function(prop) {
				return _.has(options, prop);
			})) {
			var unix_time = parseFloat(options.unix_time);

			if(_.isNaN(unix_time) || unix_time < 0) {
				hide_human_display();
				$("input#human_time").addClass("error");
				return;
			}
			$("input#human_time").removeClass("error");

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
					unix_time += parseFloat(options.tz_info.time_offset);
				}
			}

			var unix_moment = moment(unix_time);
			var formatted_time = unix_moment.format(options.format)

			$("div.human_time div.output").text(formatted_time);
			$("input#unix_time").removeClass("error");
		} else {
			hide_human_display();
		}
	};

	var hide_unix_display = function() {
		$("div.unix_time div.output").text("");
	};
	var update_unix_display = function(options) {
		if(_.all(["human_time", "format", "unix_format", "time_zone", "tz_info"], function(prop) {
				return _.has(options, prop);
			})) {
				var parsed_time = Date.parse(options.human_time);
				if(parsed_time === null) {
					hide_unix_display();
					$("input#human_time").addClass("error");
					return;
				}
				$("input#human_time").removeClass("error");
				var unix_time = parsed_time.getTime();
				if(options.time_zone === "utc") {
					unix_time -= moment().zone() * 60 * 1000;
				} else if(options.time_zone === "city") {
					if(_.isNull(options.tz_info)) {
						hide_unix_display();
						return;
					} else {
						unix_time -= moment().zone() * 60 * 1000;
						unix_time -= parseFloat(options.tz_info.timezoneOffset);
					}
				}

				if(options.unix_format === "seconds") {
					unix_time = Math.round(unix_time/1000.0);
				}
				$("div.unix_time div.output").text(unix_time);
		} else {
			hide_unix_display();
		}
	};


	(function() {
		var unix_format;
		$("input:radio[name=unix_format]").change(function() {
													var value = $(this).val();
													if(unix_format !== value) {
														unix_format = value;
														update_display({unix_format: value});
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
														update_display({time_zone: value});
													}
												});
		$("input:radio[name=time_zone]#"+cached_options.time_zone).attr("checked", true).change();
	}());

	(function() {
		var city_input=cached_options.city_input;
		var unix_timestamp_input = cached_options.unix_time;
		var human_time = cached_options.human_time;
		var ajax_timeout;
		$("input:radio[name=time_zone]").change(function() {
			if(!$("input:radio[name=time_zone]#city").attr("checked")) {
				$("input#time_location").removeClass("error success pending");
			}
		});
		$("input#time_location")	.on("focus", function() {
										$("input:radio[name=time_zone]#city").attr("checked", true).change();
										$(this).one("mouseup.select", 
												function() {
													_.defer(_.bind(function() {
														$(this).select();
													}, this))
											});

										_.delay(function() {
											$(this).off("mouseup.select");
										}, 2000, this);
									})
									.keydown(function() {
										_.defer(_.bind(function() {
											$(this).change();
										}, this))
									})
									.val(city_input)
									.add("input#unix_time, input#human_time")
									.change(function() {
										if($("input:radio[name=time_zone]#city").attr("checked")) {
											var civ = $("input#time_location").val();
											var uiv = $("input#unix_time").val();
											var hiv = $("input#human_time").val();

											var tval;

											if(converting_from === "unix") {
												tval = parseFloat(uiv);
												if($("input:radio#seconds").is(":checked")) {
													tval *= 1000;
												}
											} else {
												tval = Date.parse(hiv).getTime();
											}



											if(civ !== city_input || uiv !== unix_timestamp_input || hiv !== human_time) {
												city_input = civ;
												unix_timestamp_input = uiv;
												human_time = hiv;

												update_display({tz_info: null, city_input: civ});
												$("input#time_location").removeClass("error success")
																		.addClass("pending");
												$("span.time_location_details").text("");
												window.clearTimeout(ajax_timeout);
												ajax_timeout = window.setTimeout(_.bind(function(civ, tval) {
													$.ajax("/tz", {
														data: {
															q: civ
															, t: tval
														}

														, success: function(data) {
															if(data.status === "error") {
																update_display({tz_info: null, city_input: civ});
																if($("input:radio[name=time_zone]#city").attr("checked")) {
																	$("input#time_location").removeClass("success pending")
																							.addClass("error");
																}
															} else {
																update_display({tz_info: data, city_input: civ});
																if($("input:radio[name=time_zone]#city").attr("checked")) {
																	$("input#time_location").removeClass("error pending")
																							.addClass("success");
																	$("span.time_location_details").text(data.timezoneAbbr);
																	_.delay(function() {
																		$("input#time_location").removeClass("success");
																	}, 2000);
																}
															}
														}
														, error: function(data) {
															update_display({tz_info: null, city_input: civ});
															if($("input:radio[name=time_zone]#city").attr("checked")) {
																$("input#time_location").removeClass("success pending")
																						.addClass("error");
															}
														}
													});
												}, this, civ, tval), 500);
											}
										}
							});
		window.setInterval(function() {
			$("input#time_location").change();
		}, 500);
	}());

	(function() {
		var unix_timestamp_input = cached_options.unix_time;
		$("input#unix_time")	.focus()
								.on("focus", function() {
										$(this).one("mouseup.select", 
												function() {
													_.defer(_.bind(function() {
														$(this).select();
													}, this))
											});

										_.delay(function() {
											$(this).off("mouseup.select");
										}, 2000, this);
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
										update_display({unix_time: value});
									}
								})
								.val(unix_timestamp_input)
								.change();
		window.setInterval(function() {
			$("input#unix_time").change();
		}, 500);
	}());

	(function() {
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
										update_display({format: value});
									}
								})
								.change();
		window.setInterval(function() {
			$("input#human_format").change();
		}, 500);
	}());


	$("a#swap").click(function() {
		if(converting_from === "unix") {
			$("div.human_time div.input input")	.val($("div.human_time div.output").text())
												.change();
			converting_from = "human";
		} else {
			$("div.unix_time div.input input")	.val($("div.unix_time div.output").text())
												.change();
			converting_from = "unix";
		}
		update_converting();
	});

	var update_converting = function() {
		if(converting_from === "unix") {
			$("div.human_time").appendTo("div.content");
			$("div.unix_time").prependTo("div.content");

			$("div.unix_time div.input").show();
			$("div.unix_time div.output").hide();
			$("div.human_time div.input").hide();
			$("div.human_time div.output").show();

			$("input#human_format").attr("disabled", false);
		} else {
			$("div.unix_time").appendTo("div.content");
			$("div.human_time").prependTo("div.content");

			$("div.unix_time div.input").hide();
			$("div.unix_time div.output").show();
			$("div.human_time div.input").show();
			$("div.human_time div.output").hide();
			
			$("input#human_format").attr("disabled", true);
		}
		$("div.input:visible input").focus().select();
		update_display();
	};
	update_converting();

	(function() {
		var human_format = cached_options.human_format;
		$("input#human_time")	.val(human_format)
								.on("focus", function() {
										$(this).one("mouseup.select", 
												function() {
													_.defer(_.bind(function() {
														$(this).select();
													}, this))
											});

										_.delay(function() {
											$(this).off("mouseup.select");
										}, 2000, this);
									})
								.keydown(function() {
									_.defer(_.bind(function() {
										$(this).change();
									}, this))
								})
								.change(function() {
									var value = $(this).val();
									if(human_format !== value) {
										human_format = value;
										update_display({human_time: value});
									}
								})
								.change();
		window.setInterval(function() {
			$("input#human_format").change();
		}, 500);
	}());

	$("div.input:visible input").focus().select();

	$("a#options").click(function() {
		var time_box = $(this).parent().parent();
		if($("div.dialog", time_box).is(":visible")) {
			$("div.dialog", time_box).hide();
			$(this).text("+");
		} else {
			$("div.dialog", time_box).show();
			$(this).text("-");
		}
	});

	$("div.options div.dialog").hide();
});
