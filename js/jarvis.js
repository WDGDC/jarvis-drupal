(function($, jarvis) {

	var hsMenuHrefs = [];
	var newContent = [];
	var interval;
	var jarvisAjax = null;

	var ajaxurl = 'jarvis/autocomplete';

	function count(str,ma){
		var a = new RegExp(ma,'gi'); // Create a RegExp that searches for the text ma globally
		return str.match(a) == null ? 0 : str.match(a).length; //Return the length of the array of matches
	}

	var first_set = false;
	var NL = "\n";

	/* Build a searchable menu for Jarvis. */ 
	function fnJarvisMenu(arrDurpalMenu, depth){
		var arrMenuToReturn = [];
		var strMarkup = "";
		depth = (typeof depth !== 'undefined') ? depth : 0;

		$.each(arrDurpalMenu, function(idx, itm){
			var strLinkName = itm['link']['link_title'];

			arrMenuToReturn[strLinkName] = {
				'key' : idx,
				'href' : Drupal.settings.basePath + itm.link.link_path,
				'children' : null,
				'arguments' : arguments
			}

			strSpaces = Array(depth).join(' ');

			//strMarkup += strSpaces + '<ul style="margin-left:'+ (depth * 15) +'px" >'+ NL;
			strMarkup += strSpaces +'<li><a href="'+ arrMenuToReturn[strLinkName]['href'] +'">'+ strLinkName +'</a></li>'+ NL;

			if(typeof itm['below'] !== 'undefined'){
				child_item = fnJarvisMenu(itm['below'], (depth + 1));
				arrMenuToReturn[strLinkName]['children'] = child_item;

				strMarkup += strSpaces + '<li>'+ NL;
				strMarkup += child_item['markup_string'] + NL;
				strMarkup += strSpaces + '</li>'+ NL;
			}

			strMarkup += strSpaces +'</ul>'+ NL;
		});


		arrMenuToReturn['markup_string'] = strMarkup;

		return arrMenuToReturn;
	}


	$(document).ready(function(e) {

		function fnGetMenuItems(){
			$('#idJarvisMenu a').each(function(idx, itm){
				var jThis = $(itm);

				var titlePrefix = '';

				jThis.parents('.wp-submenu, .ab-sub-wrapper').prev('.wp-has-submenu, .ab-item').each(function(idx){
					if(idx > 0){
						titlePrefix += ' :: ';
					}

					titlePrefix += $(this).text();
				});

				titlePrefix = titlePrefix != '' ? titlePrefix +': ' : '';

				hsMenuHrefs.push({
					"id": null,
					"title": titlePrefix + jThis.text() ,
					"type": "Menu Item",
					"kind": "href",
					"relv_id": "0",
					"relv_title": "0",
					"relv_type": "0",
					"edit_url": jThis.attr('href')
				});
			});

			if(hsMenuHrefs.length <= 0){
			  setTimeout(fnGetMenuItems, 20);
			}
		}


		//--- List of Menu Links ---//
			fnGetMenuItems();

		//--- backwards compatiblity addition ---//
		$.fn.extend({
			propAttr: $.fn.prop || $.fn.attr
		});

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

					$.each(hsMenuHrefs, function(idx, itm){
						if(count(itm.title, request.term) > 0){
							newContent.push(itm);
						}
					});
		
		      		response(newContent);

					if (interval) {
						clearTimeout(interval);
					}
					interval = setTimeout(function(){
						var term = request.term;

						if(jarvisAjax) {
							jarvisAjax.abort();
							jarvisAjax = null;
						}

						jarvisAjax = $.ajax({
						  type: "POST",
						  url: Drupal.settings.basePath + ajaxurl,
						  cache: false, 
						  data: {
						  	'q': term
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
				if(item.kind == 'node') {
					item.edit_url = '/' + item.edit_url;
				}
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

		var jarvisDataProcessed = fnJarvisMenu(jarvis.menus);
		$(document.body).append('<div style="display:none" id="idJarvisMenu">'+ jarvisDataProcessed['markup_string'] +'</div>');
		delete jarvis.menus;
		delete jarvisDataProcessed;
	});

})(jQuery, jarvis || {});