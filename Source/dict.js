/*
	Dict.js, a dict.json interface
	Copyright (c) 2010 Piotrek Marciniak, MIT Style License
*/

var Dict = new Class({
		  options: {
		  		  baseId: 'dict'
		  		, captions: {
		  					  submit: 'Look up'
		  					, cancel: 'Cancel'
		  					, notFound: 'No definitions found.'
		  					, stateFailed: 'Error while getting definition.'
		  					, stateCancelled: 'Request cancelled.'
		  					, stateLoading: 'Retrieving definition...'
		  					, suggestion: 'Did you mean:'
		  		}
		  		, hotkey: {
		  					  key: null
		  					, alt: false
		  					, control: false
		  					, shift: false
		  					, meta: false
		  		} 
		  		, ignoreKeys: false
		  		, dictJsonUrl: '/dict.json'
		  		, closeable: true
		  		, pollHash: true
		  		, pollHashInterval: 200
		  		, modifyHash: true
		  		, modifyTitle: true
		  		, customStatus: ''
		  		, hideStatus: true
		  		, cacheSize: 64
		}
		
		, Implements: [ Options, Events ]
		
		, initialize: function (options) {
			this.setOptions(options);
			
			this.implement();
		
			this.initVars();
			this.initEvents();
		
			this.build();

			this.scanLinks();
			
			//If we dont' wan't to repeatedly poll the hash, we check it only once.
			if (this.options.pollHash)
				this.checkHashIntervalId = this.checkHash.periodical(this.options.pollHashInterval, this);
			else
				this.parseHash();
		}
		
		, implement: function () {
			//in case mootools Extras or any other implementation aren't included
			//code partly from http://davidwalsh.name/mootools-show-hide
			if ( !Element.hide ) {
				Element.implement({
					hide: function() {
						this.setStyle('display','none');
					}
				});
			}
			
			if ( !Element.show ) {
				Element.implement({
					show: function() {
						this.setStyle('display','');
					}
				});
			}
		}
		
		, initVars: function () {
			this.lastHash = '';
			this.el = {};
			this.cacheWords = [];
			this.cacheDefs = [];
			this.word = '';
			this.definition = '';
			
			this.state = '';
			
			this.initialTitle = document.title;
			
			this.request = new Request.JSON({
									  method: 'get'
									, url: this.options.dictJsonUrl
								});
		}
		
		, initEvents: function () {
			this.setReqEvents();
			
			document.addEvent('keydown', this.onKey.bind(this));
		}
		
		, build: function () {
			this.el.container = new Element('div', { id: this.options.baseId + '-container'});
			this.el.main = new Element('div', { id: this.options.baseId + '-main'});
			this.el.form = new Element('form', { id: this.options.baseId + '-form'
												});
			this.el.input = new Element('input', {id: this.options.baseId + '-input'
													,type: 'text'
													});
			this.el.submit = new Element('input', {id: this.options.baseId + '-submit'
													, type: 'submit'
													, value: this.options.captions.submit
													});
			this.el.reset = new Element('input', {id: this.options.baseId + '-reset'
													, type: 'reset'
													, value: this.options.captions.cancel
													});
			this.el.def = new Element('div', {id: this.options.baseId + '-def'});
			this.el.dbInfo = new Element('div', {id: this.options.baseId + '-dbInfo'});
			
			this.el.form.addEvent('submit', this.onFormSubmit.bind(this));
			this.el.form.addEvent('reset', this.onFormReset.bind(this));
			
			this.el.input.inject(this.el.form);
			this.el.submit.inject(this.el.form);
			this.el.reset.inject(this.el.form);
			
			this.el.form.inject(this.el.main);
			
			if ( $(this.options.customStatus) ) {
				this.el.status = $(this.options.customStatus);
			}
			else {
				this.el.status = new Element('div', {id: this.options.baseId + '-status'});
				this.el.status.inject(this.el.main);
			}
			
			this.el.def.inject(this.el.main);
			this.el.dbInfo.inject(this.el.main);
			
			this.el.main.inject(this.el.container);
			
			this.el.container.injectInside(document.body);
		}
		
		, insertLinks: function (text) {
			return text.replace(/([^<]|^)\b([\w-]{2,})\b(?![>])/g, '$1<a href="#" class="dict_showDef">$2</a>');
		}
		
		, buildLinks: function (el) {
			if ( el == null )
				el = this.el.def;
			
			el.set('html',
				this.insertLinks(el.get('html'))
			);
			
			this.scanLinks(el);
		}
		
		, scanLinks: function (parent) {
			id = (parent != null) ? '#' + parent.id : '';
			
			$$(id + ' a.dict_showDef').each(function (link) {
				link.addEvent('click', this.wordClick.bindWithEvent(this, link));

				link.removeClass('dict_showDef');
			}, this);
		}
		
		, isOpen: function () {
			return this.el.container.getStyle('display') != 'none';
		}
		
		, open: function () {
			if ( this.isOpen() ) {
				return;
			}

			this.fireEvent('open');
			
			this.clear();
			
			this.el.container.show();
			this.el.input.focus();
		}
		
		, close: function () {
			//if it isn't supposed to be closeable, we clear the interface instead;
			if ( !this.options.closeable ) {
				this.clear();
				return;
			}
		
			this.fireEvent('close');
		
			this.el.container.hide();
		}
		
		, clear: function () {
			this.fireEvent('clear');
		
			this.el.input.set('value', '');
			this.el.def.set('html', '');
			this.el.dbInfo.set('html', '');
		}
		
		, checkHash: function () {
			newHash = location.hash;
			
			if ( newHash == this.lastHash)
				return;
				
			this.lastHash = newHash;
			this.parseHash();
			
			this.fireEvent('hashchange', newHash);
		}
		
		, updateWindow: function (word) {
			if ( this.options.modifyHash ) {
				hash = ( word != '' ? '#def:' + word : '');
				location.hash = hash;
				
				// important to leave it this way! Otherwise browser might get into a loop,
				// e.g. changing spaces into '%20's, so that the script will consider the hash changed
				this.lastHash = location.hash;
			}
			
			if ( this.options.modifyTitle ) {
				document.title = ( word != '' ? '"' + word + '" — ' : '' )+ this.initialTitle;
			}
		}
		
		, parseHash: function () {
			defMatch = new RegExp('^#def:');
			
			if ( location.hash.match(defMatch) ) {
				def = decodeURI( location.hash.replace(defMatch, '') );
				
				if (def)
					this.loadDef(def);
			}
		}
		
		, onKey: function (ev) {
			if ( this.options.ignoreKeys )
				return;
			
			if ( this.isOpen() ) {
				switch (ev.key) {
					case 'esc':
						this.onFormReset(ev);
					break;
				}
			}
			else {
				if ( this.options.hotkey.key == null )
						return;
				
				hotkey = this.options.hotkey;
				console.log(hotkey);
				switch (ev.key) {
					case hotkey.key:
						if (
						   (ev.control == hotkey.control)
						&& (ev.alt == hotkey.alt)
						&& (ev.shift == hotkey.shift)
						&& (ev.meta == hotkey.meta)
						) {
							this.open();
							ev.preventDefault();
						}
					break;
				}
			}
		}
		
		, onFormSubmit: function (ev) {
			ev.preventDefault();
			
			this.loadDef(this.el.input.get('value'));
		}
		
		, onFormReset: function (ev) {
			if ( this.request.running ) {
				this.request.cancel();
			}
			else {
				this.close();
			}
			ev.preventDefault();
		}
		
		, wordClick: function (ev, link) {
			this.fireEvent('wordclick', [link]);
		
			ev.preventDefault();
			
			word = link.get('html');
			
			this.loadDef(word);
		}
		
		, setState: function (state) {
			if ( this.options.hideStatus ) {
				if ( state == 'success' )
					this.el.status.hide();
				else
					this.el.status.show();
			}
		
			switch (state) {
				case 'success':
					this.el.status.set('class', 'success');
				break;
				
				//in the future we might want to provide another reaction if the response is correct json with error message.
				case 'error':
				case 'fail':
					this.el.status.set('class', 'fail');
					
					this.el.def.set('html', this.options.captions.stateFailed);
				break;
				
				case 'cancel':
					this.el.status.set('class', 'cancel');
					
					this.el.def.set('html', this.options.captions.stateCancelled);
				break;
				
				case 'loading':
					this.el.status.set('class', 'loading');
					
					this.el.def.set('html', this.options.captions.stateLoading);
				break;
				
				default:
					return;
				break;
			}
			
			this.state = state;
			this.fireEvent('statechange', state);
		}
		
		, loadDef: function (word) {
			word = word.replace(/["\r\n]/g, '').trim();
			
			if ( ( this.state == 'success' ) && ( word.toLowerCase() == this.word.toLowerCase() ) )
				return;
			
			this.clear();
			this.open();
			
			this.updateWindow(word);
			
			this.el.input.set('value', word);
			
			this.word = word;
			this.definition = {};
			
			if ( (word != '') && !this.getDefFromCache(word) )
				this.getDef(word);
		}
		
		, getDef: function (word) {
			this.setState('loading');
			this.request.send(Hash.toQueryString({word: word, suggestions: true}));			
		}
		
		, setReqEvents: function() {
			this.request.addEvents({
				  success: function (json) {
				  	this.setState('success');
				  	
				  	//so we won't get an error accessing it's values
				  	json = new Hash(json);
					
					if ( (json.status == 'ok') && json.definitions) {
						definitions = (typeof json.definitions == 'object') ? json.definitions : [];
						
						if (json.suggestions) {
							suggestions = (typeof json.suggestions == 'object') ? json.suggestions : [];
						}
						else suggestions = [];
					}
					else {
						this.setState('error');
						return;
					}
					
					this.definition = new Hash(definitions[0] ? definitions[0] : {});
					
					if (this.definition.def) {
						this.addToCache(this.word, this.definition);
						this.displayDef();
					}
					else if ( suggestions.length ) {
						this.displayDef(
									  this.options.captions.notFound
									  	+ ' ' + this.options.captions.suggestion
										+ '<ul class="suggestions"><li>'
										+ this.insertLinks(suggestions.join('</li><li>'))
										+ '</li></ul>'
						);
						
						this.scanLinks();
					}
					else {
						this.displayDef(this.options.captions.notFound);
					}
					
				}.bind(this)
				
				, failure: function () {
					this.setState('fail');
				}.bind(this)
				
				, cancel: function () {
					this.setState('cancel');
				}.bind(this)
			});
		}
		
		, parseDef: function (def, word) {
			wordReg = new RegExp('^' + word + '$', 'im');
			
			def = def.replace(wordReg, '').trim()
					.replace(/^\s*\b(([a-z]+[ ])[0-9]+)(:)/img, '<br /><br /><strong>$1</strong>$3')
					.replace(/^\s*\b([0-9]+)(:)/img, '<br /><strong>$1</strong>$2')
					.replace(/^[\s\r\n]*(<br( \/)?>)+/, '')
					.replace(/\{([^\}]+)\}/g, '<em>$1</em>')
				;
			
			return def;
		}
		
		, displayDef: function (def) {
			if ( def == null ) {
				this.el.def.set('html', this.parseDef(this.definition.def, this.word));
				this.el.dbInfo.set('html', this.definition.db.desc);

				this.buildLinks();
			}
			else
				this.el.def.set('html', def);
		}
		
		, getDefFromCache: function (word) {
			idx = this.cacheWords.indexOf(word.toLowerCase());
			
			if ( idx == -1)			
				return false;
			
			this.definition = this.cacheDefs[idx];
			
			this.displayDef();
			
			this.cacheWords.splice(idx, 1);
			this.cacheDefs.splice(idx, 1);
			
			this.addToCache(word, this.definition);
			
			return true;
		}
		
		, addToCache: function (word, def) {
			this.removeFromCache(word);
			
			this.cacheWords.unshift( word.toLowerCase() );
			this.cacheDefs.unshift(def);
			
			this.cacheWords = this.cacheWords.slice(0, this.options.cacheSize);
			this.cacheDefs = this.cacheDefs.slice(0, this.options.cacheSize);			
		}
		
		, removeFromCache: function (word) {
			idx = this.cacheWords.indexOf(word.toLowerCase());
			
			if ( idx == -1)
				return;
			
			console.log(idx);
			
			this.cacheWords.splice(idx, 1);
			this.cacheDefs.splice(idx, 1);			
		}
});