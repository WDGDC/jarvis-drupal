(function($, jarvis) {

	var interval;
	var jarvisAjax = null;

	var ajaxurl = 'jarvis/autocomplete';

	function count(str,ma){
		var a = new RegExp(ma,'gi'); // Create a RegExp that searches for the text ma globally
		return str.match(a) == null ? 0 : str.match(a).length; //Return the length of the array of matches
	}

	$(document).ready(function(e) {

		$('body').keydown(function(e) {
			var target  = e.target || e.srcElement;
			var tagName = target.tagName;
			var key = e.keyCode;
			var esc = 27; // Escape keycode
			
			if (tagName == 'SELECT' || tagName == 'TEXTAREA' || e.altkey || e.shiftKey)
				return;

			// key esc
			if (key === esc) {
				WpJarvisPlugin.close();
				return;
			}

			// key hotkey
			if (tagName !== 'INPUT' && key === jarvis.hotkey) {
				e.preventDefault();
				WpJarvisPlugin.init();
				return;
			}
		});

		$('body').click(function(e){
			var $target = $(e.target);
			var container = '#jarvis-container';
			
			// Ignore clicks within Jarvis
			if ($target.is(container) || $target.parents(container).length)
				return;

			WpJarvisPlugin.close();
		});


		var proto = $.ui.autocomplete.prototype,
			initSource = proto._initSource;

		$.extend( proto, {
			_initSource: function() {
				if (!this.options.jarvis) {
					initSource.call(this);

					return;
				}

				this.source = function(request, response) {
					var newContent = [];

					$.each(jarvis.menu_items, function(idx, item){
						if(count(item.title, request.term) > 0){
							newContent.push(item);
						}
					});
		
		      		response(newContent);

					if (interval)
						clearTimeout(interval);
					
					interval = setTimeout(function(){
						if(jarvisAjax) {
							jarvisAjax.abort();
							jarvisAjax = null;
						}

						jarvisAjax = $.ajax({
						  type: "POST",
						  url: jarvis.ajax_search,
						  cache: true, 
						  data: {
						  	'q': request.term
						  },
						  success: function(strData){
						  	jarvisData = JSON.parse(strData);

								if (!jarvisData.results)
									jarvisData.results = [];

								// --- Remove search spinner from search --- //
								$('#jarvis-text').removeClass('working');

								response( newContent.concat(jarvisData.results) );

							}
						});
					}, 100);

				};
			},

			_renderItem: function( ul, item) {
				if (!this.options.jarvis) {
					proto._renderItem.call(this, [ul, item]);
					return;
				}
				var itemType = item.type;
				var itemType = itemType.replace('_', ' ');
				
				return $('<li></li>').data('item.autocomplete', item).append('<a class="' + item.type + '" href="' + item.edit_url + '">' + item.title + '<br><span class="jarvis-type">Type: ' + itemType + '</span></a>')
						.appendTo(ul);
			}
		});

		WpJarvisPlugin = {
			inited: false,

			close: function() {
				$('#jarvis-overlay, #jarvis-container').hide();
				$('#jarvis-text').blur();
			},

			create: function(){
				$('<div id="jarvis-overlay"></div><div id="jarvis-container"><input type="text" id="jarvis-text" autofocus /></div>').appendTo(document.body);

				var $overlay = $('#jarvis-overlay');
				var $field   = $('#jarvis-text');

				$field.autocomplete({
					source: 'data.php',
					autoFocus: true,
					appendTo: '#jarvis-container',
					jarvis: true,
					delay: 0,

					focus: function(e, ui) {
						// return false;
					},

					response: function(e, ui) {
						var text = 'Found ' + ui.content.length + ' results';
						if ($('#jarvis-footer').length)
							$('#jarvis-footer').text(text).show();
						else
							$('#jarvis-container').append('<div id="jarvis-footer">' + text + '</div>');
					},

					select: function(e, ui) {
						document.location.href = ui.item.edit_url || ui.item.perma_url;

						// return false;
					}, 

					search: function() {
						$(this).addClass('working');
					},

					hideSpinner: function() {
						$(this).removeClass('working');
					}
				});

				$field.unbind('blur').blur(function(e) {
					return false;
				});

				$field.focus();
			},

			init: function() {
				if (!WpJarvisPlugin.inited) {
					WpJarvisPlugin.create();

					WpJarvisPlugin.inited = true;
					return;
				}

				$('#jarvis-overlay, #jarvis-container').show();
				$('#jarvis-text').focus();
			}

		};
	});

})(jQuery, jarvis || {});