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
		  		, buildLinks: true
		  		, modifyHash: true
		  		, modifyTitle: true
		  		, customStatus: ''
		  		, hideStatus: true
		  		, cacheSize: 64
		  		, defDb: 'wn'
		  		, pron: {
		  				  db: 'cmupd'
		  				, delim: ', '
		  				, openTag: '<span class="pronunciation">/'
		  				, closeTag: '/</span>'
		  		}
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
			
			if ( this.isOpen() )
				this.el.input.focus();
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
			
			// reverse items order in hash. Useful if we want to do Hash.each in reverse order.
			if ( !Hash.reverse ) {
				Hash.implement({
					reverse: function() {
						reversed = this.getValues().reverse().associate(this.getKeys().reverse());
						
						this.empty();
						this.extend(reversed);
						
						return this;
					}
				});
			}
		}
		
		, initVars: function () {
			this.lastHash = '';
			this.el = {};
			this.cacheWords = [];
			this.cacheDefs = [];
			this.cacheProns = [];
			this.word = '';
			this.definition = '';
			
			this.state = '';
			
			this.wordLinkClass = 'dict_showDef';
			this.wordLinkAttrs = 'href="#" class="'+this.wordLinkClass+'"';
			
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
													});
			this.el.reset = new Element('input', {id: this.options.baseId + '-reset'
													, type: 'reset'
													});
			this.el.def = new Element('div', {id: this.options.baseId + '-def'});
			this.el.dbInfo = new Element('div', {id: this.options.baseId + '-dbInfo'});
			
			this.el.pron = new Element('div', {id: this.options.baseId + '-pron'});
			
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
			
			// pronunciation will be injected after word header in the definition
			//this.el.pron.inject(this.el.main);
			this.el.def.inject(this.el.main);
			this.el.dbInfo.inject(this.el.main);
			
			this.el.main.inject(this.el.container);
			
			this.el.container.injectInside(document.body);
			
			this.updateCaptions();
		}
		
		, updateCaptions: function () {
			this.el.submit.set('value', this.options.captions.submit);
			this.el.reset.set('value', this.options.captions.cancel);
		}
		
		, walkTree: function (el, level) {
			if ( level == null )
				level = 1;
				
			if ( (typeof el != 'object') || el == null )
				return;
				
			switch ( $type(el) ) {
				case 'textnode':
					text = this.insertLinks(el.nodeValue);
					if ( el.nodeValue != text )
						el = this.replaceWithNodes(text, el);
				break;
				
				case 'element':
					if ( el.nodeName == 'A' ) {
						break;
					}
					
					if (!el.childNodes.length)
						break;
						
					this.walkTree(el.childNodes[0], level + 1);
				break;
				
				default:
				break;
			}
			
			if ( el != null )
				this.walkTree(el.nextSibling, level)

			return el;
		}
		
		, insertLinks: function (text) {
			// first, add links to synonym/antonym phrases, these are the only case in which
			// we should consider adding more than one word to a link
			
			// only safe for use with pure text without tags
			// rest of the words, one by one
			return text.replace(/\b([\w-]{2,})\b/g, '<a ' + this.wordLinkAttrs + '>$1</a>');
		}
		
		, insertPhraseLinks: function (el, tag, closeTag, prefix, suffix) {
			// If no closeTag is defined, assume it is the html tag
			if ( !closeTag ) {
				openTag = '<' + tag + '>';
				closeTag = '</' + tag + '>';
				
				// in this case, we preserve the tags
				if (!prefix)
					prefix = openTag;
				
				if (!suffix)
					suffix = closeTag;
			}
			// else, it might be e.g. { and } tags, so don't put them between '<' and '>'
			else {
				openTag = tag;

				// this time, if not explicitly set, we forget the tags
				if (!prefix)
					prefix = '';
				
				if (!suffix)
					suffix = '';
			}
			
			// case insensitive for Internet Explorer, which makes tags uppercase
			exp = new RegExp(
							  openTag.escapeRegExp()
								+ '([^' + openTag.substr(0, 1).escapeRegExp()
								+ ']+)' + closeTag.escapeRegExp()
							, 'gi'
							);
			
			text = el.get('html');
			
			text = text.replace(exp, prefix + '<a ' + this.wordLinkAttrs + '>$1</a>' + suffix)
			el.set('html', text);
			
			this.scanLinks(el);
		}
		
		, replaceWithNodes: function (text, node) {
			newEl = new Element('div', { html: text });
			
			// IE 6 complained otherwise
			if ( !newEl.childNodes ) {
				return;
			}
				
			while ( el = newEl.childNodes[0] ) {
				if ( typeof el != 'object')
					return;
				
				node.parentNode.insertBefore(el, node);

				lastNode = el;
			}
			
			node.parentNode.removeChild(node);
			newEl.dispose();
			
			return lastNode;
		}
		
		, buildLinks: function (el) {
			// Large elements may cause stack overflow / out of memory errors on IE 6
			if ( Browser.Engine.trident4 )
				return;
				
			if ( el == null )
				el = this.el.def;
			
			this.walkTree(el.childNodes[0]);
			
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
			this.el.pron.set('html', '');
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
					
					this.displayDef(this.options.captions.stateFailed);
				break;
				
				case 'cancel':
					this.el.status.set('class', 'cancel');
					
					this.displayDef(this.options.captions.stateCancelled);
				break;
				
				case 'loading':
					this.el.status.set('class', 'loading');
					
					this.displayDef(this.options.captions.stateLoading);
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
		
		, reloadDef: function (removeFromCache) {
			if ( !this.word )
				return;
			
			word = this.word;
			this.word = '';

			if (removeFromCache)
				this.removeFromCache(word);

			this.loadDef(word);
		}
		
		, getDef: function (word) {
			this.setState('loading');
			this.request.send(Hash.toQueryString({
													  word: word
													, suggestions: true
													, db: [
														    this.options.defDb
														  , this.options.pron.db
													]
			}));
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
					
					defs = [];
					prons = [];
					
					// as for now, we only use single non-virtual databases, so the last db description
					// is the description applicable for all definitions
					lastDefDb = {};
					lastPronDb = {};
					
					for (defIdx in definitions) {
						def = new Hash(definitions[defIdx]);
						if ( !def.db || !def.def )
							continue;

						if ( def.db.name == this.options.defDb ) {
							defs.push(def.def);
							lastDefDb = def.db;
						}
						else if ( (def.db.name == this.options.pron.db) && (prons.indexOf(def.def) < 0) ) {
							prons.push(def.def);
							lastPronDb = def.db;
						}
					}
					
					this.definition = {
										  def: defs.join("\r\n\r\n")
										, db: lastDefDb
					};
					
					this.pronunciation = prons.length ? {
										  def: this.options.pron.openTag
										  	+ prons.join(
										  				this.options.pron.closeTag
										  				+ this.options.pron.delim
										  				+ this.options.pron.openTag
										  	)
										  	+ this.options.pron.closeTag
										, db: lastPronDb
					} : '';	
					
					if (this.definition.def || this.pronunciation.def) {
						this.addToCache(this.word, this.definition, this.pronunciation);
						this.displayDef();
					}
					else if ( suggestions.length ) {
						this.displayDef(
									  this.options.captions.notFound
									  	+ ' ' + this.options.captions.suggestion
										+ '<ul class="suggestions"><li>'
										+ suggestions.join('</li><li>')
										+ '</li></ul>'
						);
						
						this.buildLinks($$('#' + this.el.def.id + ' ul.suggestions')[0]);
						
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
			wordReg = new RegExp('^(' + word + ')$', 'im');

			def = def.replace(wordReg, '<h1>$1</h1>').trim()
					// first meaning, separated by double newline
					.replace(/^\s*\b(([a-z]+[ ])1)(:)/img, '</p><p class="first"><strong>$1</strong>$3')
					
					// meaning numbers
					.replace(/^\s*\b([0-9]+)(?=:)/img, '</p><p><strong>$1</strong>')
					
					// remove </p> occuring after <h1> or at the beginning
					.replace(/(^|<\/h1>)\s*<\/p>/g, '$1')
					
					// glue words ending with dash before newline to the word following in the next line.
					.replace(/([\w-]+-)+\r?\n\s*([\w-]+)\b/g, '$1$2')
					
					// whitespaces and newlines
					.replace(/[\s\r\n]+(?=[\s\r\n])/g, '')
					
					// synonym/antonym words or phrases
					.replace(/\{([^\}]+)\}/g, '<em>$1</em>')
				;
			
			// closing <p> tags if necessary
			p = def.match(/<p\W/gi);
			pC = def.match(/<\/p>/gi);
			if ( p && pC && (p.length != pC.length) ) {
				def = def + '</p>';
			}
			
			return def;
		}
		
		, displayDef: function (def) {
			if ( def == null ) {
				if (this.definition.def) {
					this.el.def.set('html', this.parseDef(this.definition.def, this.word));
				}
				else {
					// a way for escaping
					this.el.def.set('html', '<h1></h1>');
					this.el.def.getElement('h1').appendText(this.word);
				}
				this.el.pron.set('html', this.pronunciation.def);
				
				this.el.dbInfo.set('html', (this.pronunciation.db.desc ? this.pronunciation.db.desc : '')
											+ (this.pronunciation.db.desc && this.definition.db.desc ? ', ' : '')
											+ (this.definition.db.desc ? this.definition.db.desc : '')
				);

				this.insertPhraseLinks(this.el.def, 'em');
				
				if (this.options.buildLinks)
					this.buildLinks();

				el = this.el.def.getElement('h1');
				if (el)
					this.el.pron.inject(el, 'after');
				else
					this.el.pron.inject(this.el.def, 'top');

			}
			else
				this.el.def.set('html', def);
		}
		
		, getDefFromCache: function (word) {
			idx = this.cacheWords.indexOf(word.toLowerCase());
			
			if ( idx == -1)			
				return false;
			
			this.definition = this.cacheDefs[idx];
			this.pronunciation = this.cacheProns[idx];
			
			this.displayDef();
			
			this.cacheWords.splice(idx, 1);
			this.cacheDefs.splice(idx, 1);
			this.cacheProns.splice(idx, 1);
			
			this.addToCache(word, this.definition, this.pronunciation);
			
			return true;
		}
		
		, addToCache: function (word, def, pron) {
			this.removeFromCache(word);
			
			this.cacheWords.unshift( word.toLowerCase() );
			this.cacheDefs.unshift(def);
			this.cacheProns.unshift(pron);
			
			this.cacheWords = this.cacheWords.slice(0, this.options.cacheSize);
			this.cacheDefs = this.cacheDefs.slice(0, this.options.cacheSize);			
			this.cacheProns = this.cacheProns.slice(0, this.options.cacheSize);			
		}
		
		, removeFromCache: function (word) {
			idx = this.cacheWords.indexOf(word.toLowerCase());
			
			if ( idx == -1)
				return;
			
			this.cacheWords.splice(idx, 1);
			this.cacheDefs.splice(idx, 1);			
			this.cacheProns.splice(idx, 1);			
		}
});