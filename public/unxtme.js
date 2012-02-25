$(function() {
	var cached_options = {
		unix_time: ""
		, format: "ddd MMM D, YYYY h:mm:ss a"
		, unix_format: "seconds"
	};
	var update_human_display = function(options) {
		options = _.extend(cached_options, options);
		if(_.all(["unix_time", "format", "unix_format"], function(prop) {
				return _.has(options, prop);
			})) {
			var multiplier = 1;
			if(options.unix_format === "seconds") { multiplier = 1000; }
			var unix_moment = moment(options.unix_time*multiplier);
			var formatted_time = unix_moment.format(options.format)

			$("div.human_output").text(formatted_time);
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
		$("input:radio[name=unix_format]#"+cached_options.unix_format).attr("checked", true);
	}());

	(function() {
		var on_unix_input_change = function(value) {
			update_human_display({unix_time: value});
		};

	/*
		var display_placeholder = false;
		var update_current_unix_time = function() {
			if(display_placeholder) {
				var unix_time = Math.round((new Date()).getTime()/1000);
				$("input#unix_time").attr("placeholder", unix_time);
			} else {
				$("input#unix_time").attr("placeholder", "");
			}
		};

		window.setInterval(update_current_unix_time, 1000);
		*/

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
									on_unix_input_change(value);
								}
							})
							.change()
							/*
							.on("focus", function() {
								display_placeholder = false;
								$("input#unix_time").attr("placeholder", "");
							})
							.on("blur", function() {
								display_placeholder = unix_timestamp_input === "";
								update_current_unix_time();
							})
							.val(Math.round((new Date()).getTime()/1000))
							*/
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
