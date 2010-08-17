var d;

document.addEvent('domready', function () {
	d = new Dict({
					  hotkey: { key: 'l' }
					, cacheSize: 128
	});
	
	// about show/hide with support for clicking outside the div
	$$('#a_about, #a_aboutClose').addEvent('click', function (ev) {
		if ( this.hasClass('show') ) {
			this.removeClass('show');
			document.removeEvent('click', outsideClick);
		}
		else {
			this.addClass('show');
			
			// otherwise document.onClick was triggered
			ev.stopPropagation();
			
			document.addEvent('click', outsideClick);
		}

		ev.preventDefault();
	}.bind($('about')) );
	
	// don't let the document get notified about the click
	$('about').addEvent('click', function (ev) {
		ev.stopPropagation();
	});
	
	var outsideClick = function (ev) {
		$('a_aboutClose').fireEvent('click', ev);		
	}
});
