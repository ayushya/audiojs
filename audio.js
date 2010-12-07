// A cross-browser javascript shim for html5 audio

//  To do:  
//  - Use javacript-generated css alongside global css
//  - camelCased method & variable names
//  - Add a test case for a single player with a playlist
//  - Opera cached SWF bug?
//  - MP3s are requested multiple times
//  - document.ready fails on error

(function(audioJS, audioJS_instance, container) {

  // ##The audioJS interface
  // This is the global object which provides an interface for creating new `audioJS` instances.
  // It also stores all of the construction helper methods and variables.
  container[audioJS] = {
    instance_count: 0,
    instances: {},
    // ### String storage
    // The css required by the default player. This is is injected into a `<style>` tag dynamically.
    default_css: '\
      .audiojs { font-family: monospace; position: relative; } \
      .audiojs .play_pause { clear: both; cursor: pointer; -webkit-text-selection: none; height: 20px; line-height: 20px; text-align: center; background: #eee; color: #999; border: 1px solid #eee; font-size: 8px; float: left; margin: 0px 0px 10px; overflow: hidden; } \
      .audiojs .play_pause p { width: 20px; margin: 0px; font-family: sans-serif; } \
      .audiojs .scrubber { float: left; width: 300px; height: 20px; position: relative; left: 1px; border: 1px solid #eee; padding-left: 5px; line-height: 20px; white-space: nowrap; overflow: hidden; } \
      .audiojs .progress { z-index: 1; position: absolute; top: 0px; left: 0px; bottom: 0px; width: 0px; background: #ccc; } \
      .audiojs .loaded { position: absolute; top: 0px; left: 0px; bottom: 0px; width: 0px; background: #eee; } \
      .audiojs .time { display: none; float: left; color: #999; padding: 3px 0px 0px 10px; } \
      .audiojs .time em { font-style: normal; color: #666; } \
      .audiojs .time strong { font-weight: normal; } \
      .audiojs .loading { display: none; position: absolute; top: 3px; left: 8px; }',

    // The markup for the swf. It is injected into the page if there is not support for the `<audio>` element. The `$keys` are used as a micro-templating language.  
    // `$1` The name of the flash movie  
    // `$2` The path to the swf  
    // `$3` Cache invalidation  
    flash_source: '\
      <object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" id="$1" width="1" height="1" name="$1"> \
        <param name="movie" value="$2?player_instance='+audioJS+'.instances[\'$1\']&datetime=$3"> \
        <param name="allowscriptaccess" value="always"> \
        <embed name="$1" src="$2?player_instance='+audioJS+'.instances[\'$1\']&datetime=$3" width="1" height="1" allowscriptaccess="always"> \
      </object>',

    // ### The main settings object
    // This is where all the default settings are stored. Each of these variables and methods can be overwritten by the user-provided `options` object.
    settings: {
      autoplay: false,
      loop: false,
      swf_location: './audiojs.swf',
      use_flash: (function() {
        var a = document.createElement('audio');
        return !(a.canPlayType && a.canPlayType('audio/mpeg;').replace(/no/, ''));
      })(),
      // The default markup and classes for creating the player:
      create_player: {
        markup: '\
          <div class="play_pause"> \
            <p class="play">PLY</p> \
            <p class="pause">PSE</p> \
          </div> \
          <div class="scrubber"> \
            <div class="progress"></div> \
            <div class="loaded"></div> \
          </div> \
          <div class="time"> \
            <em class="played">00:00</em>/<strong class="duration">00:00</strong> \
          </div> \
          <div class="loading">Loading...</div>',
        play_pause_class: 'play_pause',
        play_class: 'play',
        pause_class: 'pause',
        scrubber_class: 'scrubber',
        progress_class: 'progress',
        loader_class: 'loaded',
        time_class: 'time',
        duration_class: 'duration',
        played_class: 'played',
        loading_class: 'loading'
      },
      // The default event callbacks:
      track_ended: function(e) {},
      load_error: function(e) {
        var player = this.settings.create_player,
            scrubber = get_by_class(player.scrubber_class, this.wrapper),
            duration = get_by_class(player.time_class, this.wrapper),
            play_pause = get_by_class(player.play_pause_class, this.wrapper),
            loading = get_by_class(player.loading_class, this.wrapper);
        this.wrapper.style.clear = 'both';
        duration.style.display = 'none';
        play_pause.style.display = 'none';
        loading.style.display = 'none';
        scrubber.innerHTML = 'Error loading "'+this.mp3+'"';
      },
      init: function() {
        var player = this.settings.create_player,
            loading = get_by_class(player.loading_class, this.wrapper),
            play_pause = get_by_class(player.play_pause_class, this.wrapper);
        loading.style.display = 'block';
        play_pause.style.display = 'none';
      },
      load_started: function() {
        var player = this.settings.create_player,
            loading = get_by_class(player.loading_class, this.wrapper),
            time = get_by_class(player.time_class, this.wrapper),
            duration = get_by_class(player.duration_class, this.wrapper),
            play_pause = get_by_class(player.play_pause_class, this.wrapper),
            m = Math.floor(this.duration / 60),
            s = Math.floor(this.duration % 60);
        loading.style.display = 'none';
        play_pause.style.display = 'block';
        time.style.display = 'block';
        duration.innerHTML = ((m<10?"0":"")+m+":"+(s<10?"0":"")+s);
      },
      load_progress: function(loaded_percent) {
        var player = this.settings.create_player,
            scrubber = get_by_class(player.scrubber_class, this.wrapper),
            loaded = get_by_class(player.loader_class, this.wrapper);
        loaded.style.width = (scrubber.offsetWidth * loaded_percent) + 'px';
      },
      play_pause: function() {
        if (this.playing) this.settings.play();
        else this.settings.pause();
      },
      play: function() {
        var player = this.settings.create_player;
        get_by_class(player.play_class, this.wrapper).style.display = 'none';
        get_by_class(player.pause_class, this.wrapper).style.display = 'block';
      },
      pause: function() {
        var player = this.settings.create_player;
        get_by_class(player.play_class, this.wrapper).style.display = 'block';
        get_by_class(player.pause_class, this.wrapper).style.display = 'none';
      },
      update_playhead: function(percent_played) {
        var player = this.settings.create_player,
            scrubber = get_by_class(player.scrubber_class, this.wrapper),
            progress = get_by_class(player.progress_class, this.wrapper);
        progress.style.width = (scrubber.offsetWidth * percent_played) + 'px';

        var played = get_by_class(player.played_class, this.wrapper),
            p = this.duration * percent_played,
            m = Math.floor(p / 60),
            s = Math.floor(p % 60);
        played.innerHTML = ((m<10?"0":"")+m+":"+(s<10?"0":"")+s);
      }
    },
    
    // ### Contructor functions

    // `create()`  
    // Used to create a single audioJS instance.  
    // If an array is passed call back to `create_all()`.  
    // Otherwise, create a single instance and return it.  
    create: function(element, options) {
      var options = options || {}
      if (element.length) {
        return this.create_all(options, element);
      } else {
        return this.new_instance(element, options);
      }
    },

    // `create_all()`  
    // Used to create multiple audioJS instances.  
    // If no array of elements is passed, then automatically find any `<audio>` tags on the page and create instances for them.
    create_all: function(options, elements) {
      var audio_elements = elements || document.getElementsByTagName('audio'),
          instances = []
          options = options || {};
      for (var i = 0, ii = audio_elements.length; i < ii; i++) {
        instances.push(this.new_instance(audio_elements[i], options));
      }
      return instances;
    },
    
    // ### Creating and returning a new instance
    // This goes through all the steps and logic forking required to build out a usable audioJS instance.
    new_instance: function(element, options) {
      var element = element,
          s = this.helpers.clone(this.settings),
          id = 'audiojs'+this.instance_count,
          wrapper_id = 'audiojs_wrapper'+this.instance_count,
          instance_count = this.instance_count++;

      // Check for autoplay and loop attributes and write them into the settings.
      if (element.getAttribute('autoplay') != undefined) s.autoplay = true;
      if (element.getAttribute('loop') != undefined) s.loop = true;
      // Merge the default settings with the user-defined options.
      if (options) this.helpers.merge(s, options);

      // Inject the player html if required.
      if (s.create_player.markup) element = this.create_player(element, s.create_player, wrapper_id);
      else element.parentNode.setAttribute('id', wrapper_id);

      // Build out a new audioJS instance.
      var new_audio = container[audioJS_instance].apply(element, [s]);

      // If `<audio>` isn't supported, insert the swf & attach the required events for it.
      if (s.use_flash) {
        this.inject_flash(new_audio, id);
        this.attach_flash_events(new_audio.wrapper, new_audio);
      }

      // Attach event callbacks to the new audioJS instance.
      this.attach_events(new_audio.wrapper, new_audio);

      // Store the newly-created audioJS instance.
      this.instances[id] = new_audio;
      return new_audio;
    },

    // ### Helper methods for constructing a working player
    // Inject a wrapping div and the markup for the html player.
    create_player: function(element, player, id) {
      // Wrap the `<audio>` element and append the player markup to that wrapper.
      var wrapper = document.createElement('div'),
          element = element;
      wrapper.setAttribute('class', 'audiojs');
      wrapper.setAttribute('id', id);
      // Fix IE's broken implementation of innerHTML & `cloneNode` for HTML5 elements.
      if (/MSIE/.test(navigator.userAgent)) {
        wrapper.innerHTML = player.markup;
        wrapper.appendChild(this.helpers.clone_html5_node(element));
        element.outerHTML = wrapper.outerHTML;
        wrapper = document.getElementById(id);
      } else {
        wrapper.appendChild(element.cloneNode(true));
        wrapper.innerHTML = wrapper.innerHTML + player.markup;
        element.parentNode.replaceChild(wrapper, element);
      }
      return wrapper.getElementsByTagName('audio')[0];
    },

    // Attaches the callbacks from the `<audio>` object into an audioJS instance.
    attach_events: function(wrapper, audio) {
      var ios = (/(iPod|iPhone|iPad)/).test(navigator.userAgent),
          player = audio.settings.create_player,
          play_pause = get_by_class(player.play_pause_class, wrapper),
          scrubber = get_by_class(player.scrubber_class, wrapper),
          left_pos = function(elem) {
            var curleft = 0;
            if (elem.offsetParent) {
              do { curleft += elem.offsetLeft; } while (elem = elem.offsetParent);
            }
            return curleft;
          };
      
      // If this is the first interaction with the player, iOS needs to start preloading the audio file.  
      // Otherwise, just play/pause.
      container[audioJS].events.add_listener(play_pause, 'click', function(e) {
        if (ios && audio.element.readyState == 0) audio.init.apply(audio);
        audio.play_pause.apply(audio);
      });

      container[audioJS].events.add_listener(scrubber, 'click', function(e) {
        var relative_left = e.clientX - left_pos(this);
        audio.skip_to(relative_left / scrubber.offsetWidth);
      });

      // _If `<audio>` isn't supported, don't register the following handlers._
      if (audio.settings.use_flash) return;
      
      // Use a timer here rather than the official `progress` event, as Chrome has issues calling `progress` when loading files already in cache.
      var timer = setInterval(function() {
        if (audio.element.readyState == 0) {
          // Start the player in its pause state.
          audio.pause.apply(audio);
          // iOS doesn't start preloading the audio file until the user interacts manually, so this stops the loader being displayed prematurely.
          if (!ios) audio.init.apply(audio);
        } else if (audio.element.readyState > 1) {
          // Call `pause()` again to handle Chrome missing `readyState` `0`.
          audio.pause.apply(audio);
          // If autoplay has been set, start playing the audio.
          if (audio.settings.autoplay) audio.play.apply(audio);
          clearInterval(timer);
          // Once we have data, then start tracking the load progress.
          var timer2 = setInterval(function() {
            audio.load_progress.apply(audio);
            if (audio.loaded_percent >= 1) clearInterval(timer2);
          });

        }
      }, 10);

      container[audioJS].events.add_listener(audio.element, 'timeupdate', function(e) {
        audio.update_playhead.apply(audio);
      });

      container[audioJS].events.add_listener(audio.element, 'ended', function(e) {
        audio.track_ended.apply(audio);
      });

      container[audioJS].events.add_listener(audio.source, 'error', function(e) {
        clearInterval(timer);
        audio.settings.load_error.apply(audio);
      });

    },

    // Flash requires a slightly different API to the `<audio>` element, so this method is used to overwrite the default event handlers.
    attach_flash_events: function(element, audio) {
      audio['load_progress'] = function(loaded_percent, duration) {
        audio.loaded_percent = loaded_percent;
        audio.duration = duration;
        audio.settings.load_started.apply(audio);
        audio.settings.load_progress.apply(audio, [audio.loaded_percent]);
      }
      audio['skip_to'] = function(percent) {
        if (percent > audio.loaded_percent) return;
        audio.update_playhead.call(audio, [percent])
        audio.element.skip_to(percent);
      }
      audio['update_playhead'] = function(percent_played) {
        audio.settings.update_playhead.apply(audio, [percent_played]);
      }
      audio['play'] = function() {
        audio.playing = true;
        // IE doesn't allow a method named `play()` to be exposed through `ExternalInterface`, so lets go with `pplay()`.  
        // <http://dev.nuclearrooster.com/2008/07/27/externalinterfaceaddcallback-can-cause-ie-js-errors-with-certain-keyworkds/>
        audio.element.pplay();
        audio.settings.play.apply(audio);
      }
      audio['pause'] = function() {
        audio.playing = false;
        // Use `ppause()` for consistency with `pplay()`, even though it isn't really required.
        audio.element.ppause();
        audio.settings.pause.apply(audio);
      }
      audio['load_started'] = function() {
        // Load the mp3 specified by the audio element into the swf.
        audio.element.loader(audio.mp3);

        if (audio.settings.autoplay) audio.play.apply(audio);
        else audio.settings.pause.apply(audio);
      }
    },
    
    // ### Injecting an swf from a string
    // Build up the swf source by replacing the `$keys` and then inject it into the page.
    inject_flash: function(new_audio, id) {
      var flash_source = this.flash_source.replace(/\$1/g, id)
      flash_source = flash_source.replace(/\$2/g, this.settings.swf_location)
      // `(+new Date)` ensures the swf is requested fresh each time
      flash_source = flash_source.replace(/\$3/g, (+new Date + Math.random()));

      // Use an `innerHTML` insertion technique that will work with IE.
      var html = new_audio.wrapper.innerHTML,
          div = document.createElement('div');
          div.innerHTML = flash_source + html;

      new_audio.wrapper.innerHTML = div.innerHTML;
      new_audio.element = this.helpers.get_swf(id);
    },
    
    // ## Helper functions
    helpers: {
      // **Merge two objects, with `obj2` overwriting `obj1`**  
      // The merge is shallow, but that's all that is required for our purposes.
      merge: function(obj1, obj2) {
        for (attr in obj2) {
          if (obj1.hasOwnProperty(attr) || obj2.hasOwnProperty(attr)) {
            obj1[attr] = obj2[attr];
          }
        }
      },
      // **Clone a javascript object (recursively)**
      clone: function(obj){
        if (obj == null || typeof(obj) !== 'object') return obj;
        var temp = new obj.constructor();
        for (var key in obj) temp[key] = arguments.callee(obj[key]);
        return temp;
      },
      // **Handle all the IE6+7 requirements for cloning `<audio>` nodes**  
      // Create a html5-safe document fragment by injecting an `<audio>` element into the document fragment.
      clone_html5_node: function(audio_tag) {
        var fragment = document.createDocumentFragment();
        fragment.createElement('audio');
        var div = fragment.createElement('div');
        fragment.appendChild(div);
        // _outerHTML is not supported by Firefox, so this technique is reserved for IE._
        div.innerHTML = audio_tag.outerHTML;
        return div.firstChild;
      },
      // **Cross-browser `<object>` / `<embed>` element selection**
      get_swf: function(name) {
        var swf = document[name] || window[name];
        return swf.length > 1 ? swf[swf.length - 1] : swf;
      }
    },
    // ## Event-handling
    events: {
      memory_leaking: false,
      listeners: [],
      // **A simple cross-browser event handler abstraction**
      add_listener: function(element, eventName, func) {
        // For modern browsers use the standard DOM-compliant addEventListener.
        if (element.addEventListener) {
          element.addEventListener(eventName, func, false);
          // For older versions of Internet Explorer, use `attachEvent`.  
          // Scope `this` to refer to the calling element and register each listener so the containing elements can be purged on page unload.
        } else if (element.attachEvent) {
          this.listeners.push(element);
          if (!this.memory_leaking) {
            window.attachEvent('onunload', function() {
              for (var i = 0, ii = this.listeners.length; i < ii; i++) {
                container[audioJS].events.purge(this.listeners[i]);
              }
            });
            this.memory_leaking = true;
          }
          element.attachEvent('on' + eventName, function() {
            func.call(element, window.event);
          });
        }
      },

      // **Douglas Crockford's IE6 memory leak fix**  
      // <http://javascript.crockford.com/memory/leak.html>  
      // This is used to release the memory leak created by fixing `this` scoping for IE. It is called on page unload.
      purge: function(d) {
        var a = d.attributes, i;
        if (a) {
          for (i = 0; i < a.length; i += 1) {
            if (typeof d[a[i].name] === 'function') d[a[i].name] = null;
          }
        }
        a = d.childNodes;
        if (a) {
          for (i = 0; i < a.length; i += 1) purge(d.childNodes[i]);
        }
      },

      // **DOMready function**  
      // As seen here: <http://webreflection.blogspot.com/2007/09/whats-wrong-with-new-iecontentloaded.html>  
      // _This needs replacing, as any internal script errors will cause IE to go into an infinite loop._
      ready: (function(ie) {
        var d = document;
        return ie ? function(c){
          var n = d.firstChild,
              f = function(){
                try{ c(n.doScroll('left')) }
                catch(e){ setTimeout(f, 10) }
              };
              f()
        } :
        /webkit|safari|khtml/i.test(navigator.userAgent) ? function(c){
          var f = function(){
            /loaded|complete/.test(d.readyState) ? c() : setTimeout(f, 10)
          };
          f();
        } :
        function(c){
          d.addEventListener("DOMContentLoaded", c, false);
        }
      })(/*@cc_on 1@*/)

    }
  }
  
  // ## The audioJS class
  // We create one of these per audio tag and then push them into `audioJS['instances']`.
  container[audioJS_instance] = function(settings) {
    // First check the `<audio>` element directly for a src, then if one is not found, look for a `<source>` element.
    var mp3 = (function(audio) {
      var source = audio.getElementsByTagName('source')[0];
      return audio.getAttribute('src') || (source ? source.getAttribute('src') : null);
    })(this);
    // Each audio instance returns an object which contains an API back into the `<audio>` element.
    return {
      // Storage properties:
      element: this,
      wrapper: this.parentNode,
      source: this.getElementsByTagName('source')[0] || this,
      mp3: mp3,
      settings: settings,
      load_started_called: false,
      loaded_percent: 0,
      duration: 1,
      playing: false,
      // API access events:  
      // These call back into the user-provided settings object and handle all the required internal processing.
      update_playhead: function() {
        var percent_played = this.element.currentTime / this.duration;
        this.settings.update_playhead.apply(this, [percent_played]);
      },
      skip_to: function(percent) {
        if (percent > this.loaded_percent) return;
        this.element.currentTime = this.duration * percent;
        this.update_playhead();
      },
      load: function(mp3) {
        this.source.setAttribute('src', mp3);
        this.mp3 = mp3;
      },
      load_error: function() {
        this.settings.load_error.apply(this);
      },
      init: function() {
        this.settings.init.apply(this);
      },
      load_started: function() {
        this.duration = this.element.duration;
        this.update_playhead();
        this.settings.load_started.apply(this);
      },
      load_progress: function() {
        if (this.element.buffered != undefined && this.element.buffered.length) {
          if (!this.load_started_called) {
            this.load_started();
            this.load_started_called = true;
          }
          var duration_loaded = this.element.buffered.end(this.element.buffered.length - 1);
          this.loaded_percent = duration_loaded / this.duration;

          this.settings.load_progress.apply(this, [this.loaded_percent]);
        }
      },
      play_pause: function() {
        if (this.playing) this.pause();
        else this.play();
      },
      play: function() {
        this.playing = true;
        this.element.play();
        this.settings.play.apply(this);
      },
      pause: function() {
        this.playing = false;
        this.element.pause();
        this.settings.pause.apply(this);
      },
      track_ended: function(e) {
        this.settings.track_ended.apply(this);
        this.skip_to.apply(this, [0]);
        if (!this.settings.loop) this.pause.apply(this);
      }
    }
  }
  
  // **getElementsByClassName**  
  // Having to rely on `getElementsByTagName` is pretty inflexible, so a modified version of Dustin Diaz's `getElementsByClassName` has been included.
  // This version cleans up a bit and uses the native DOM method if it's available.
  var get_by_class = function(searchClass, node, tag) {
    var matches = [],
        node = node || document,
        tag = tag || '*',
        els = node.getElementsByTagName(tag),
        pattern = new RegExp("(^|\\s)"+searchClass+"(\\s|$)");

    if (document.getElementsByClassName) {
      matches = node.getElementsByClassName(searchClass);
    } else {
      for (i = 0, j = 0, l = els.length; i < l; i++) {
        if (pattern.test(els[i].className)) {
          matches[j] = els[i];
          j++;
        }
      }
    }
    return matches.length > 1 ? matches : matches[0];
  }

})('audioJS', 'audioJS_instance', this);