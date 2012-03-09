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
	};

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
				offset -= parseFloat(options.tz_info.timezoneOffset) * 60 * 1000;
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
		var parsed_time = Date.parse(options.human_time);
		if(_.isNull(parsed_time)) {
			return undefined;
		}
		return parsed_time.getTime();
	};

	var update_unix_display = function() {
		var unix_time = get_human_time();
		if(unix_time === undefined) {
			hide_unix_display();
			$("input#human_time").addClass("error");
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
											ajax_timeout = window.setTimeout(_.bind(function(city_input, tval) {
												$.ajax("/tz", {
													data: {
														q: city_input
														, t: tval
													}

													, success: function(data) {
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
																var offset= Math.round(-data.timezoneOffset/60.0);
																var offset_str;
																if(offset> 0) { offset_str = "+" + offset; }
																else { offset_str = String(offset); }
																$("div.time_location_details").text(data.formatted_address + " (" + data.timezoneAbbr + ", UTC" + offset_str + ")");
																_.delay(function() {
																	$("input#time_location").removeClass("success");
																}, 2000);
															}
														}
													}
													, error: function(data) {
														update_options({tz_info: null, city_input: city_input});
														if($("input:radio[name=time_zone]#city").attr("checked")) {
															$("input#time_location").removeClass("success pending")
																					.addClass("error");
														}
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
