/**
 * Author: Andrew Cantino
 * Date: 2007
 * Please do not copy without permission.
 *
 *
 * This is ancient code.
 *
 */


// Some Ajax stuff
var req = null;
var failCount = 0;
var script = "contact2.cgi";

// Handle contact form

function sendContact() {
	var filter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;	
	var email = document.getElementById("contact_email").value;
	var message = document.getElementById("contact_message").value;
	var name = document.getElementById("contact_name").value;
	if (!message || !email || !name) {
		alert("Please fill in all fields.");
		return;
	}
	if (!filter.test(email)) {
		alert('Please enter a valid e-mail address.');
		return;
	}
	if (req != null) { doFail(); return; }
	setCommentFeedback("Thanks!  Sending your comment...");
	sendServerRequest(script, processContactSend, makePost(["email",email,"message",message,"name",name]));
}

function doFail() {
	alert("Server busy.  Please try again in just a second.");
	failCount++;
	if (failCount > 2) req = null;
}

function processContactSend() {
	if (req.readyState == 4) {
		if (req.status == 200) {
			if (req.responseText != "OK") {
				alert("A server error has occurred.");
				hideCommentFeedback();
			} else {
				setCommentFeedback("Comment sent, thank you!");
				clearFormFields();
				setTimeout("setCommentFeedback(''); hideCommentFeedback();", 5000);
			}
		} else {
			alert("Server error, unable to send message.");
			hideCommentFeedback();
		}
		req = null;
	}
}

function clearFormFields() {
	document.getElementById("contact_email").value = '';
	document.getElementById("contact_message").value = '';
	document.getElementById("contact_name").value = '';
}

function hideCommentFeedback() {
	document.getElementById('submit_comment').value = "Submit";
}

function setCommentFeedback(feedback) {
	document.getElementById('submit_comment').value = feedback;
}

function makePost(ar) {
	var pairs = [];
	for (var i = 0; i < ar.length; i+=2) {
		pairs.push(ar[i] + "=" + encodeURIComponent(ar[i+1]));
	}
	return pairs.join("&");
}

function sendServerRequest(url, pFunction, query) {
	req = null;
	failCount = 0;
	if(window.XMLHttpRequest) {
		try {
			req = new XMLHttpRequest();
		} catch(e) {
			req = null;
		}
	} else if(window.ActiveXObject) {
		try {
			 req = new ActiveXObject("Msxml2.XMLHTTP");
		} catch(e) {
			try {
				req = new ActiveXObject("Microsoft.XMLHTTP");
			} catch(e) {
				req = null;
			}
		}
	}
	if(req) {
		req.open("post", url, true);
		req.onreadystatechange = pFunction;
		req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
		req.send(query);
	}
}
