/*eslint-env node*/
/*eslint-disable no-unused-params */

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com


var cloudantCred = {

  "apikey": "gPwEdl4biql9sRyZXDyO6Imghmz93JDFUN9oqR5qr1J-",
  "host": "9c58288b-45b2-4ad9-9cac-fb01e222ae9a-bluemix.cloudantnosqldb.appdomain.cloud",
  "iam_apikey_description": "Auto generated apikey during resource-key operation for Instance - crn:v1:bluemix:public:cloudantnosqldb:eu-gb:a/5324f3177f174f47b6075e68e093eb49:fc41ff52-ae01-4f34-b0bc-163814da7904::",
  "iam_apikey_name": "auto-generated-apikey-4c4d8571-64a8-46ee-b91e-4e646587ffd1",
  "iam_role_crn": "crn:v1:bluemix:public:iam::::serviceRole:Manager",
  "iam_serviceid_crn": "crn:v1:bluemix:public:iam-identity::a/5324f3177f174f47b6075e68e093eb49::serviceid:ServiceId-eee59260-b2e3-40b3-a4b5-b73699c78611",
  "password": "df6b5b790d328c7722c291b5aea85acf722214704ba2cf0877fa4500f6408da0",
  "port": 443,
  "url": "https://9c58288b-45b2-4ad9-9cac-fb01e222ae9a-bluemix:df6b5b790d328c7722c291b5aea85acf722214704ba2cf0877fa4500f6408da0@9c58288b-45b2-4ad9-9cac-fb01e222ae9a-bluemix.cloudantnosqldb.appdomain.cloud",
  "username": "9c58288b-45b2-4ad9-9cac-fb01e222ae9a-bluemix"

};


var express = require('express');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
var app = express();

// Connect to the database
var cloudant = require("cloudant")(cloudantCred.url);
var mydb = cloudant.db.use("visitor-log");



// Visitors data structure
var visitors;
var dbRev = "";
var log = "";




var updateVisitors = () => {
	
	var updateData = {
    		"_id": "visitors",
        	value: visitors    	
	};
	
	if (dbRev !== "")
		updateData["_rev"] = dbRev;
		
	mydb.insert(updateData,
    	(err, body) => {
    		if (err === undefined)
    			dbRev = body["rev"];
    		else
    			log += "updateVisitors: " + err + "<br/>";
    	}
    );
};



// Read the visitors data structure. 
mydb.get("visitors", (err, body) => {
	
	// No visitors yet, create it.
    if (err !== null && err.statusCode === 404) {
    	visitors = {"Test user": {arrived: Date.now().valueOf()}};
    	updateVisitors();
	} else {
		visitors = body.value;
		dbRev = body["_rev"];
	}

});




// Code to manipulate visitors data structure
var visitorNames = () => {
	return Object.keys(visitors);	
};

var currentVisitorNames = () => {
	return visitorNames().filter((name) => visitors[name].arrived !== undefined);
};


var nonCurrentVisitorNames = () => {
	return visitorNames().filter((name) => visitors[name].arrived === undefined);
};


var currentVisitorList = () => {
	return currentVisitorNames().map((name) => {
		var retVal = {};
		retVal[name] = visitors[name];
		return retVal;
	});
};

var currentVisitors = () => {
	return currentVisitorList().reduce((a, b) => {
		var bKey = Object.keys(b)[0];
			
		a[bKey] = b[bKey];
		
		return a;
	});
};






var getVisitor = (name) => visitors[name];

var setVisitor = (name, values) => {
	visitors[name] = values;
	updateVisitors();		
};



var logOut = (name) => {
	var oldRecord = getVisitor(name);
	
	if (oldRecord === undefined) 
		return `Error, ${name} is unknown`;
	
	if (oldRecord.arrived === undefined)
		return `Error, ${name} is not logged in`;
		
	var history = oldRecord.history;
	
	// If this is the first visit
	if (history === undefined) 
		history = [];
			
	
	history.unshift({
		arrived: oldRecord.arrived,
		left: Date.now().valueOf()
	});
	
	setVisitor(name, {history: history});
	
	return `OK, ${name} is logged out now`;
};



var logIn = (name) => {
	var oldRecord = getVisitor(name);
	var history;
	
	// First time we see this person
	if (oldRecord === undefined)    
		history = [];   // No history
		
	// Already logged in	
	else if (oldRecord.arrived !== undefined) 
		return `Error, ${name} is already logged in`;
		
	// Not logged in, already exists
	else history = oldRecord.history;
	
	setVisitor(name, {
		arrived: Date.now().valueOf(),
		history: history
	});	
	
	return `OK, ${name} is logged in now`;	
};


var testFunctions = [
	{path: "visitorNames", func: visitorNames},	
	{path: "currentVisitorNames", func: currentVisitorNames},	
	{path: "nonCurrentVisitorNames", func: nonCurrentVisitorNames},		
	{path: "currentVisitorList", func: currentVisitorList},		
	{path: "currentVisitors", func: currentVisitors},	
	{path: "visitors", func: () => visitors},	
	{path: "logIn", func: () => logIn("Avimelech ben-Gideon")},
	{path: "logOut", func: () => logOut("Avimelech ben-Gideon")}	
];


testFunctions.map((item) => 
	app.get(
		`/test/${item.path}`, 
		/* @callback */ function(req, res) {
			res.send(item.func());
		}
	)
);



// Given a time difference in miliseconds, return a string with the approximate value
var tdiffToString = (msec) => {
	var sec = msec/1000;
		
	if (sec < 60)
		return Math.floor(sec) + " second" + (sec < 2 ? "" : "s"); 
		
	if (sec < 3600)
		return Math.floor(sec/60) + " minute" + (sec < 60*2 ? "" : "s");
		
	if (sec < 3600*24)
		return Math.floor(sec/3600) + " hour" + (sec < 3600*2 ? "" : "s");
	
	return Math.floor(sec/(3600*24)) +  " day" + (sec < 3600*24*2 ? "" : "s");
};


// Given a history entry (arrived and left times), create a table row with that information
var histEntryToRow = (entry) => {
	return `<tr>
		<td>${new Date(entry.arrived)}</td>
		<td>${new Date(entry.left)}</td>
		<td>${tdiffToString(entry.left-entry.arrived)}</td>
		</tr>`;
		
		// The Date need to be new, otherwise we are just modifying the same object and all dates in
		// the history table are the same.
};

// Given a history, create a table with it
var histToTable = (history) => {
	if (history === undefined)
		return "";
		
	if (history.length === 0)
		return "";
			
	return `<details>
		<table border style="background-color: yellow">
			<tr>
				<th>
					Arrived
				</th>
				<th>
					Left
				</th>
				<th>
					Time here
				</th>
			</tr>
			${history.map(histEntryToRow).reduce((a, b) => a+b)}
		</table>
	</details>`;
};



// Given a user name, create a table row for the user
var userToRow = (name) => {
	var visitor = getVisitor(name);
	
	return `<tr>
		<td>
			${name}
		</td>
		<td>
			${visitor.arrived !== undefined ? `Yes, for the last ${tdiffToString(Date.now().valueOf()-visitor.arrived)}` : "No"}
		</td>
		<td>
			${histToTable(visitor.history)}
		</td>
	</tr>
		`;			
};


// Given a user name list, create a table for those users
var usersToTable = (list) => {
	
	if (list.length === 0)
		return "";
	
	return `
		<table border>
			<tr>
				<th>
					Name
				</th>
				<th>
					Here?
				</th>
				<th>
					History
				</th>
			</tr>
		${list.map(userToRow).reduce((a,b) => a+b)}
		</table>
		`;
};


var visitorsHTML = () => {
	return `
				<h2>Full Visitor List</h2>
					${usersToTable(visitorNames())}
	`;
};


var currentVisitorsHTML = () => {
	return `
				<h2>Current Visitor List</h2>
					${usersToTable(currentVisitorNames())}
		`;
};



var loginForm = () => {
	return `<h2>Log in a visitor</h2>
			<form method="get" action="login">
				Visitor to log in: <input type="text" name="user">
			</form>`;
};


var logoutForm = () => {
	if (currentVisitorNames().length === 0) 
		return "No users to log out";
	
	return `
		<h2>Log out a visitor</h2>
		<ul>
			${currentVisitorNames()
				.map(name => `<li> 
					<a href="logout?user=${encodeURI(name)}">${name}</a> 
					</li>`)
				.reduce((a,b) => a + b)}
		</ul>`;	
};


var embedInHTML = (str) => {
	return `<html><body>${str}</body></html>`;	
};

app.get("/visitors", (req, res) => {
	res.send(embedInHTML(visitorsHTML()));
});

app.get("/currentVisitors", (req, res) => {
	res.send(embedInHTML(currentVisitorsHTML()));
});


app.get("/login", (req, res) => {
	if (req.query.user === undefined)
		res.send(embedInHTML(loginForm()));
	else 
		res.send(logIn(req.query.user));
});


app.get("/logout", (req, res) => {
	if (req.query.user === undefined)
		res.send(embedInHTML(logoutForm()));
	else
		res.send(logOut(req.query.user));
});



app.get(["/index.html", "/"], (req, res) => {
	res.send(embedInHTML(`
		${loginForm()}
		<hr />
		${logoutForm()}
		<hr />
		${currentVisitorsHTML()}
		<hr />
		${visitorsHTML()}
	`));	
});

app.get("/log", (req, res) => {
	res.send(log);
});


app.get("/hello", /* @callback */ function(req, res) {
	res.send("Hello, world");
});


/*
// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));
*/



// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});