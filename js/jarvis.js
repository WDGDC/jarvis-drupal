/**
 * @file
 * Jarvis Search
 */

(function($, $document, jarvis) {

  var interval;
  var jarvisAjax = null;

  var ajaxurl = 'jarvis/autocomplete';

  $document.ready(function(e) {

    $document.keydown(function(e) {
      var target  = e.target || e.srcElement;
      var tagName = target.tagName;
      var key = e.keyCode;
      var esc = 27; // Escape keycode
      
      if (tagName == 'SELECT' || tagName == 'TEXTAREA' || target.contentEditable === 'true' || e.altkey || e.shiftKey)
        return;

      // key esc
      if (key === esc) {
        JarvisSearch.close();
        return;
      }

      // key hotkey
      if (tagName !== 'INPUT' && key === jarvis.hotkey) {
        e.preventDefault();
        JarvisSearch.init();
        return;
      }
    });

    $document.click(function(e){
      var $target = $(e.target);
      var container = '#jarvis-container';
      
      // Ignore clicks within Jarvis
      if ($target.is(container) || $target.parents(container).length)
        return;

      JarvisSearch.close();
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
          var results = [];

          // Menu item matches
          var q = request.term;
          var q_words = q.split(/\s+/g);
          var q_words_regex = [];
          var q_words_contain = [];
          var boundary = '[^a-z0-9_]*'; // RegExp Word boundary

          // Create regexes for search terms
          $.each(q_words, function(i, q_word){
            if (q_word.length === 0) return;
            var q_word_escaped = q_word.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); // Escape any special characters @link http://stackoverflow.com/a/6969486

            var q_contain = new RegExp(q_word_escaped, 'i'); // Convert to case insensitive search regex
            q_words_contain.push(q_contain);
            
            var q_full = new RegExp(boundary + q_word_escaped + boundary, 'i'); // Convert to case insensitive search regex
            var q_start = new RegExp(boundary + q_word_escaped, 'i'); // Convert to case insensitive search regex
            q_words_regex.push(q_full, q_start);
          });

          // Match items 
          $.each(jarvis.menu_items, function(i, item){
            var contains = 0;
            $.each(q_words_contain, function(j, q_word_contain){
              if (item.title.match(q_word_contain)) {
                contains += 1;
              }
            });
            // Eliminate items which don't contain all words
            if (contains !== q_words_contain.length) return;


            var jarvis_sort = 0;
            // Keyword match
            $.each(q_words_regex, function(j, q_word_regex){
              if (item.title.match(q_word_regex)) {
                jarvis_sort += 1;
              }
            });
            item.jarvis_sort = jarvis_sort; // Sorting key
            results.push(item);
          });

          // Sort items
          results.sort(function(a, b){
            if (a.jarvis_sort === b.jarvis_sort && a.title.length === b.title.length) {
              return 0; // Absolute tie
            } else if ( a.jarvis_sort === b.jarvis_sort ) {
              return a.title.length > b.title.length ? 1 : -1; // Greater is lower
            }
            return a.jarvis_sort > b.jarvis_sort ? -1 : 1; // Greater is higher
          });

          // Send response
              response(results);

          if (interval)
            clearTimeout(interval);
          
          interval = setTimeout(function(){
            if (jarvisAjax) {
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

                response( results.concat(jarvisData.results) );
              }
            });
          }, 100);

        };
      },

      _renderItem: function(ul, item) {
        if (!this.options.jarvis) {
          proto._renderItem.call(this, [ul, item]);
          return;
        }
        var itemType = item.type;
        var itemType = itemType.replace(/_[a-z]/g, function(txt){ return ' ' + txt.substr(1).toUpperCase(); });
        
        return $('<li></li>').data('item.autocomplete', item)
            .append(''
              + '<a class="' + item.type + '" href="' + item.edit_url + '">'
                + item.title
                + '<br>'
                + '<span class="jarvis-type">Type: ' + itemType + '</span>'
              + '</a>'
             )
            .appendTo(ul);
      }
    });

    JarvisSearch = {
      inited: false,

      close: function() {
        $('#jarvis-overlay, #jarvis-container').hide();
        $('#jarvis-text').blur();
      },

      create: function(){
        $('<div id="jarvis-overlay"></div><div id="jarvis-container"><input type="text" id="jarvis-text" autofocus /><div id="jarvis-footer"></div></div>').appendTo(document.body);

        var $overlay = $('#jarvis-overlay');
        var $field   = $('#jarvis-text');

        $field.autocomplete({
          source: 'data.php',
          autoFocus: true,
          appendTo: '#jarvis-container',
          jarvis: true,
          delay: 0,

          response: function(e, ui) {
            var text = 'Found ' + ui.content.length + ' results';
            $('#jarvis-footer').text(text).show();
          },

          select: function(e, ui) {
            document.location.href = ui.item.edit_url || ui.item.perma_url;
          }, 

          search: function() {
            $(this).addClass('working');
          },

          close: function() {
            $('#jarvis-footer').hide();
          }
        });

        $field.unbind('blur').blur(function(e) {
          return false;
        });

        $field.focus();
      },

      init: function() {
        if (!JarvisSearch.inited) {
          JarvisSearch.create();

          JarvisSearch.inited = true;
          return;
        }

        $('#jarvis-overlay, #jarvis-container').show();
        $('#jarvis-text').focus().select().autocomplete('search');
      }

    };
  });

})(jQuery, jQuery(document), jarvis || {});
