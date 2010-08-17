var d;

document.addEvent('domready', function () {
	d = new Dict({ closeable: false });
	
	$$('#a_about, #a_aboutClose').addEvent('click', function (ev) {
		if ( this.hasClass('show') ) {
			this.removeClass('show');
			document.removeEvent('click', outsideClick);
		}
		else {
			this.addClass('show');
			ev.stopPropagation();
			document.addEvent('click', outsideClick);
		}

		if (ev)
			ev.preventDefault();
	}.bind($('about')) );
	
	$('about').addEvent('click', function (ev) {
		ev.stopPropagation();
	});
	
	var outsideClick = function (ev) {
		$('a_aboutClose').fireEvent('click');		
	}
});
