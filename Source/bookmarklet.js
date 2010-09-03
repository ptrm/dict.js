// the bookmarklet code. It is later compressed
// with the YUI Compressor, http://developer.yahoo.com/yui/compressor/

if (!_dict_ptrm_eu_popup) var _dict_ptrm_eu_popup = null;

(function (){
	var url = 'http://dict.ptrm.eu/#def:';
	
	// from http://davidwalsh.name/text-selection-ajax, translated into frameworkless version
	var getSelection = function() {
		fs = [
			  function() { return window.getSelection(); }
			, function() { return document.getSelection(); }
			, function() { 
				var selection = document.selection && document.selection.createRange();
				if(selection.text) { return selection.text; }
				return false;
			}
		];
		
		var sel = null;
		
		// "i in fs" won't suffice if Array gets extended, e.g. by mootools (we'd get $family and other indices then)
		for (i=0; i<fs.length; i++) {
			try {
				sel = fs[i]();
			}
			catch (err) {};
			
			if (sel && (sel = new String(sel).replace(/^\s+|\s+$/g,'')))
				return sel;
		}
		
		return false;
	}
	
	sel = getSelection();
	if (!sel)
		return;
	
	if (_dict_ptrm_eu_popup)
		_dict_ptrm_eu_popup.close();
	
	url += encodeURIComponent(sel);
	
	_dict_ptrm_eu_popup = window.open(
		  url
		, '_dict_ptrm_eu_popup'
		, 'height=500,width=450,status=0,menubar=0,toolbar=0,location=0,resizable=1'
		, false
	);
	
})();
