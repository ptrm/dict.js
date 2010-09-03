var d;

// let's not share all variables
(function() {
document.addEvent('domready', function () {
	buildPrefs();
	FancyForm.start($$('input'), {
									  onClasses: {
												checkbox: 'checked',
												radio: 'checked'
									}
									, offClasses: {
												checkbox: 'unchecked',
												radio: 'unchecked'
									}
	});

	loadPrefs();

	d = new Dict(dictOptions);

	// about show/hide with support for clicking outside the div
	var clicked = function (ev) {
		boxParent = this.getParent();
		show = !boxParent.hasClass('show');

		hideAll();

		if ( show ) {
			boxParent.getElement('div.box').fireEvent('open');
			boxParent.addClass('show');
			
			document.addEvent('click', outsideClick);
			
			// otherwise document.onClick will be triggered
			ev.stopPropagation();
		}
		else
			boxParent.getElement('div.box').fireEvent('close');
	
		ev.preventDefault();
	}
	
	$('prefs_save').addEvent('click', function(ev) {
														ev.preventDefault();
														savePrefs();
														hideAll();
														$('prefs').fireEvent('open');
	});
	
	$('prefs_discard').addEvent('click', function(ev) {
														ev.preventDefault();
														hideAll();
														$('prefs').fireEvent('close');
	});
	
	$$('div.boxParent a.toggle').each(function (el) {
		el.addEvent(
					  'click'
					, clicked.bind(el)
		);
	});
	
	// don't let the document get notified about the click
	$$('div.box').addEvent('click', function (ev) {
		ev.stopPropagation();
	});
	
	var outsideClick = function (ev) {
		$$('div.boxParent.show div.box').fireEvent('close');
		hideAll();
	}
	
	var hideAll = function () {
		$$('div.boxParent').removeClass('show');
		document.removeEvent('click', outsideClick );
	}
});

var dictOptions = {
				  hotkey: { key: 'l' }
				, cacheSize: 128
				, closeable: false
				, captions: { submit: '→', cancel: '×' }
};

var captions = {
	  pl: {
	  	  name: 'pl'
	  	  
		, dict: {
			  submit: dictOptions.captions.submit
			, cancel: dictOptions.captions.cancel
			, notFound: 'Nie znaleziono definicji.'
			, stateFailed: 'Błąd podczas pobierania definicji.'
			, stateCancelled: 'Anulowano.'
			, stateLoading: 'Pobieranie definicji...'
			, suggestion: 'Czy chodziło ci o:'
		}
		
		, elements: {
			/*  'a[rel=about]': 'info'
			  
			,*/ '#about': '<h1><a href="http://github.com/ptrm/dict.js">Dict.js</a>'
							+ '	<span class="desc">– prosty front-end do <a href="http://github.com/ptrm/dict.json">dict.json</a>.'
							+ '</span></h1>'
							+ '<p>'
							+ '	Sprawdź znaczenie ktoregokolwiek słowa z definicji klikając na nie.'
							+ '</p>'
							+ '<p>'
							+ '	Użyj przycisków wstecz i naprzód aby przęłączać pomiędzy ostatnimi definicjami.'
							+ '</p>'
							+ '<h1>Credits</h1>'
							+ '<p>'
							+ '	Napisano przy użyciu <a href="http://mootools.net/">mootools</a> i <a href="http://lipidity.com/fancy-form/">FancyForm</a>.'
							+ '</p>'
							+ '<p>'
							+ '	Obsługa historii w Internet Explorerze oparta na <a href="http://github.com/tkyk/jquery-history-plugin">jQuery history plugin</a> Taku Sano (<a href="http://www.mikage.to">Mikage Sawatari</a>) z poprawkami <a href="http://github.com/tkyk">Takayuki Miwa</a>.'
							+ '</p>'
							+ '<p>'
							+ '	Układ definicji inspirowany <a href="http://en.wikipedia.org/wiki/Dictionary_(software)">Dictionary.app</a> od Apple.'
							+ '</p>'
						
			//, 'a[rel=prefs]': 'preferencje'
			
			, 'label[for=prefs_dontBuildLinks]': {
											  title: 'ustaw jeśli przeglądarka zużywa za dużo RAMu podczas przeglądania tej strony'
			}
			
			, 'label[for=prefs_dontBuildLinks] span': {
											  html: 'nie umieszczaj linków w definicjach'
			}
						
			, '#prefs_lang span.legend': 'język:'
			
			, 'label[for=radio_lang_default] span': 'auto'
			
			, '#prefs_save': 'zapisz'
			
			, '#prefs_discard': 'anuluj'
			
			, '#bookmarkletBox p': 'Przeciągnij link poniżej do paska zakładek. Następnie możesz zaznaczyć słowo lub frazę na dowolnej stronie i użyć stworzonej zakładki do wyświetlenia definicji.'
		}
	}
};

var prefs = $H({
				  lang: null
});

// functions to be called on preference change
var onPrefChange = $H({
						  'lang': translate
						, 'dontBuildLinks': updateDictPrefs
});

var oldPrefs = null;
var curLang = null;

function updateDictPrefs() {
	actions = {}

	// check if the option changed, double negation for readability
	if ( dictOptions.buildLinks != !prefs.dontBuildLinks) {
		dictOptions.buildLinks = !prefs.dontBuildLinks;
		
		actions.reloadDef = true;
	}
	
	if (captions[curLang] && (typeof captions[curLang].dict == 'object')) {
		dictOptions.captions = captions[curLang].dict;

		actions.updateCaptions = true;		
	}

	if (d) {
		d.setOptions(dictOptions);
		
		if (actions.updateCaptions)
			d.updateCaptions();
		
		if (actions.reloadDef)
			d.reloadDef();
	}
}

function prefsChanged() {
	// check whether preference changed and has a function assigned to be called on change
	onPrefChange.each(function (func, pref) {
		if ( !oldPrefs || ( prefs[pref] != oldPrefs[pref]) ) {
			func();
		}
	});

	oldPrefs = $H(prefs);
}

function buildPrefs() {
	$H(captions).include('_builtIn', { name: 'en' }).each(function(langObj, lang) {
		nEl = new Element('label', {
									html: '<input type="radio" name="radio_lang" '
											+ 'value="' + lang + '" />'
											+ langObj.name
						});

		nEl.inject($('prefs_lang'), 'bottom');
	});

	$('prefs').addEvent('close', updateForm);
}

function loadPrefs() {
	cookiePrefs = oldPrefs ? $H(oldPrefs) : JSON.decode(Cookie.read('dictPrefs'), true);

	if ( typeof cookiePrefs != 'object') {
		return;
	}
	
	cookiePrefs = $H(cookiePrefs);
	cookiePrefs.each(function (value) { value = encodeURIComponent(value) });
	
	prefs.extend( cookiePrefs );

	updateForm();
	
	prefsChanged();
}

function updateForm() {
	$('prefs_dontBuildLinks').set('checked', prefs.dontBuildLinks == true);

	// if no items are to be selected, select the default one
	if ( !$$('input[name=radio_lang][value=' + prefs.lang + ']').set('checked', true).length ) {
		$$('input[name=radio_lang][value=_default]').set('checked', true);
	}
	
	FancyForm.chks.each(function (el) { FancyForm.update(el); });
}

function savePrefs() {
	prefs.dontBuildLinks = $('prefs_dontBuildLinks').get('checked');
	
	lang = $$('input[name=radio_lang]:checked').getLast().get('value');
	prefs.lang = ( lang == '_default' ) ? null : lang;
	
	Cookie.write(
				  'dictPrefs'
				, prefs
					.filter(function (value) { return ( value != null ) })
					.toJSON()
				, { duration: 365 }
				);
	
	prefsChanged();
}

function translate() {
	lang = $pick( prefs.lang, navigator.language, navigator.userLanguage, navigator.systemLanguage, '_builtIn' )
			.replace(/^[a-z]-.*/i, '')
			.toLowerCase()
			;
	
	// if there is no translation, fall back to built in
	if ( !captions[lang] )
		lang = '_builtIn';

	// return if language didn't change
	if (curLang == lang)
		return;

	// if builtIn language is set, return
	if ( (lang == '_builtIn') ) {
		// if curLang is not empty, reload the page
		if (curLang)
			location.reload();
		
		return;
	}

	curLang = lang;
	
	updateDictPrefs();
	
	elements = $H(captions[lang].elements);
	elements.each(function (attrs, elSelector) {
		if (typeof attrs == 'string')
			attrs = {html: attrs};
		
		$$(elSelector).set(attrs);
	});
}

})(); // end of function wrapping