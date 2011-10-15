/**
 * Author: Andrew Cantino
 * Date: 2009
 *
 *
 * This is old code.
 *
 */

// Some globals
var headerHeight = 150;
var headerWidth = 739;
var headerPadding = 11;
var sepHeight = 40;
var paneHeight = 330;

// Variables to hold various DOM references.
var wtop, header, nav, footer, buttons;
var windowSize;
// The stack of Pane objects.
var panes = [];
// A quick lookup hash for the set of visible Panes and their locations in the stack.
var shownPanes = {};
	
$(function() {
	$('#year').html(new Date().getFullYear()); // Setup footer
	setupDivs();
	setTimeout("preloadImages();", 5000);
	setupHeaderBackgroundWrapper(); // Setup the header and the 1 min image rotation.
  newPane('about'); // Show the default pane.
	if (document.location.hash && document.location.hash.length > 0) {
    newPane(document.location.hash.substring(1));
    // document.location.hash = '';
	}
	registerLinks($('body'));
	$('#footer,#wtop').show();
});

function registerLinks(elem) {
  $('.plink', elem).each(function() {
    var link = $(this);
    link.click(function() {
      show(link.attr('pane'), !link.hasClass('navLink'));
      return false;
    });
  });
}

$(window).resize(updateSizes);

// Header images and their text color encoding.  Currently all white.
var headerImages = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];

function preloadImages() {
  var images = [];
  for (var i = 1; i < headerImages.length + 1; i++) {
    images.push(new Image());
    images[images.length - 1].src = 'backgrounds/bg' + i + '.jpg';
  }
}

function setupHeaderBackground(e) {
	var randomHeader = Math.floor(Math.random() * headerImages.length);
	header.css('background-image', 'url(backgrounds/bg' + (randomHeader + 1) + '.jpg)').
	       css('background-repeat', 'no-repeat').css('background-position', 'center').
	       css('color', headerImages[randomHeader] ? '#FFF' : '#000');
}

function setupHeaderBackgroundWrapper() {
		setTimeout(function() {
        setupHeaderBackgroundWrapper();
    }, 1000 * 60);
		setupHeaderBackground();
}

function show(contentId, opt_hide_back_button) {
	if (shownPanes[contentId] != null) {
		unpane(contentId);
	} else {
		newPane(contentId, opt_hide_back_button);
	}
	return false;
}

function newPane(contentId, opt_hide_back_button) {
	shownPanes[contentId] = panes.length;
	panes.push(new Pane(contentId, $(document.body), document.getElementById('content_' + contentId).innerHTML, 
	                    panes.length + 1, headerWidth, 'rgb(230,211,191)'));
	if (panes.length > 1 && !opt_hide_back_button) {
		panes[panes.length - 1].prependToContent("<div style='float: right; position: relative; left:0px; top: " + 
		                                          (paneHeight - 38) + "px'>[<a href='#' onclick='unpane(); return false;'>Back</a>]</div>");
	}
	updateSizes();
	panes[panes.length - 1].animateIn();
	updateButtons(contentId);
}

function unpane(opt_target) {
	if (opt_target) {
		if (shownPanes[opt_target] != panes.length - 1) {
			var count = 0;
			var index = shownPanes[opt_target];
			for (var i = panes.length - 1; i > index; i--) {
				var p = setTimeout("if (panes[panes.length - 1].target == '" + panes[i].target + "') { var p = panes.pop(); delete shownPanes[p.target]; p.animateOutAndCleanup();}", 275 * count);
				count++;
			}
		}
	} else {
		var p = panes.pop();
		if (p) {
			delete shownPanes[p.target];
			p.animateOutAndCleanup();
		}
	}
	updateButtons(opt_target);
}

function updateButtons(contentId) {
	var c = contentId;
	if (! c) c = panes[panes.length - 1].target;
	
	$('#nav a.navItem').removeClass('selected');
	$('#nav a.navItem[pane="' + c + '"]').addClass('selected');
}

function setupDivs() {
	wtop = $('#wtop');
	header = $('#header').click(setupHeaderBackground);
  header.attr('unselectable', 'on').css('MozUserSelect', 'none').bind('selectstart.ui', function() { return false; });
	nav = $('#nav');
	footer = $('#footer');
	buttons = $('#nav');
	
	updateSizes();
}

function updateSizes() {
	var d_width = $(document).width();

	for(var i = 0; i < panes.length; i++) {
		panes[i].updateDimensions(headerHeight + sepHeight * 2 + 10, (d_width - headerWidth) / 2, headerWidth, paneHeight);
	}
	
	wtop.css('top', px(sepHeight)).
	     css('width', px(headerWidth + headerPadding)).
	     css('left', px((d_width - headerWidth) / 2));

	footer.css('top', px(paneHeight + headerHeight + sepHeight * 3)).
	       css('width', px(headerWidth + headerPadding - 5)).
	       css('left', px((d_width - headerWidth) / 2));
}

function px(s) {
  return (s + 'px');
}

// Pane constructor
function Pane(target, where, content, zindex, width, color) {
	this.div = $('<div></div>')
	this.div.addClass('pane');
	this.div.html(content);
	registerLinks(this.div);
	this.state = 'hidden';
	this.target = target;
	this.color = color;
	this.zindex = zindex;
	this.left = -1 * (width + 100);
	this.shift = 1;
	this.div.css('left', this.left + 'px');
	this.div.css('background-color', color);
	this.parent = where;
	where.append(this.div);
}

Pane.prototype.updateDimensions = function(top, left, width, height) {
	this.wtop = top;
	this.targetLeft = left;
	this.width = width;
	this.height = height;
	
	this.div.css('top', this.wtop + 'px').
	         css('width', this.width + 'px').
	         css('height', this.height + 'px').
	         css('z-index', this.zindex);

	if (this.state == 'visible') {
		this.div.css('left', left + 'px');
	} else {
		this.div.css('left', (-1 * (width + 100)) + 'px');
	}
};

Pane.prototype.clear = function() {
	if (this && this.div) this.div.remove();
	if (this.div) this.div = null;
};

Pane.prototype.stop = function() {
	clearInterval(this.animationInterval);
	this.animationInterval = null;
	if (this.shift == -1) {
		this.clear();
	}
};

Pane.prototype.animateIn = function() {
	this.lastTime = new Date().getTime();
	this.shift = 1;
	var tmp = this;
	this.animationInterval = setInterval(function() { tmp.tick(); }, 50);
};

Pane.prototype.animateOutAndCleanup = function() {
	this.lastTime = new Date().getTime();
	this.shift = -1;
	var tmp = this;
	this.animationInterval = setInterval(function() { tmp.tick(); }, 50);
};

Pane.prototype.tick = function() {
	var d = new Date().getTime();
	var moveAmt = this.shift * (d - this.lastTime) * .4;
	lastTime = d;
	
	if (this.left + moveAmt > this.targetLeft) {
		this.left = this.targetLeft;
		this.state = 'visible';
		this.stop();
	} else if (this.left + moveAmt < -1 * (this.width + 400)) {
		this.left = -1 * (this.width + 100);
		this.state = 'hidden';
		this.stop();
	} else {
		this.left += moveAmt;
	}
	if (this.div) {
		this.div.css('left', this.left + 'px');
	}
};

Pane.prototype.prependToContent = function(content) {
	this.div.prepend(content);
};
