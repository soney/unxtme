$(function() {
	$("input#unix_time").focus()
						.keydown(function() {
							$(this).change();
						})
						.change(function() {
							var value = $(this).val();
							console.log(value);
						})
						.change();
});
