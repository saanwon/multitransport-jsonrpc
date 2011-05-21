// # The *Express Routing Utility*
// is a helper module for Express to provide a Django-inspired controller
// hierarchy (separated from the view hierarchy and URL hierarchy), and a
// URL generation method to be used by the controllers. The controllers are
// defined to use a directory hierarchy like so:
//
//     controllers/
//       controllers.js
//       almanac/
//         controllers.js
//         questions/
//           controllers.js
//       social/
//         controllers.js
//
// The URL hierarchy is defined by the user in a simple JSON tree such as:
//
//     {
//       '/': 'index',
//       '/almanac' : {
//         '/': 'almanac.index',
//         '/questions': {
//           '/': 'almanac.questions.index',
//           '/edit': 'almanac.questions.edit'
//         }
//       },
//       '/social': {
//         '/': 'social.index',
//         '/find': 'social.find'
//       }
//     }
//
// URLs are assembled relative to their location in the tree, so the
// ``almanac.questions.edit`` controller would have a URL of
// ``/almanac/questions/edit/``

// This utility loads source files dynamically, and requires the fs and path
// libraries to traverse the directory structure. The utils object provides a
// function to merge Javascript objects together, which is the only utility
// that is used.
var fs = require('fs');
var path = require('path');
var utils = require('./utils');

// A hash of controllers to URL Paths
var controllerToPathHash = {};

// ## The *loadControllers* function
// is a recursive function that ``require``s controllers as it traverses the
// controllers directory and places them into their correct place in the
// ``controllerObj`` hierarchy.
function loadControllers(controllerPath, controllerObj) {
	if(path.existsSync(controllerPath)) {
		if(path.existsSync(path.join(controllerPath, 'controllers.js'))) {
			controllerObj = utils.mergeObjs(controllerObj, require(path.join(path.resolve(controllerPath), 'controllers')));
		}
		var pathChildren = fs.readdirSync(controllerPath);
		for(var child in pathChildren) {
			var childPath = path.resolve(path.join(controllerPath, pathChildren[child]));
			if(fs.statSync(childPath).isDirectory()) {
				if(!controllerObj[pathChildren[child]]) {
					controllerObj[pathChildren[child]] = {};
				}
				controllerObj[pathChildren[child]] = loadControllers(childPath, controllerObj[pathChildren[child]]);
			}
		}
	} else {
		throw "Controller Path Object Invalid";
	}
	return controllerObj;
}

// ## The *getController* function
// takes a ``controllerRoute`` string and traverses the ``controllers``
// hierarchy to return the specified controller
function getController(controllers, controllerRoute) {
	var controller = controllers;
	var hierarchy = controllerRoute.split('.');
	for(var level in hierarchy) {
		if(controller[hierarchy[level]]) {
			controller = controller[hierarchy[level]];
		} else {
			throw "Invalid Controller Path Found: " + hierarchy;
		}
	}
	return controller;
}

// ## The *buildRoutes* function
// is a recursive function that traverses the URL routing hierarchy and defines
// the *Express* URL controllers for the HTTP method specified by the
// ``httpMethod`` property attached to the controller. While attaching
// controllers to URLs, it builds the ``controllerToPathHash`` hash table.
function buildRoutes(express, controllers, routeObj, currPath) {
	for(var route in routeObj) {
		if(typeof(routeObj[route]) == "string") {
			var routeUrl = currPath != "" ? currPath + "." + route : route;
			var controller = getController(controllers, routeObj[route]);
			controllerToPathHash[routeObj[route]] = routeUrl;
			routeUrl = routeUrl != '/' ? routeUrl.replace(/\/$/, "") : '/'; 
			if(controller.httpMethod && typeof(controller.httpMethod) == "string") {
				express[controller.httpMethod](routeUrl, controller);
			} else {
				express.all(routeUrl, controller);
			}
		} else if(typeof(routeObj[route] == "object")) {
			buildRoutes(express, controllers, route, routeUrl);
		} else {
			throw "Invalid Route Definition";
		}
	}
}

// ## The *registerRoutes* function
// is the external API call that loads the desired source code and attaches the
// controllers to the specified URLs.
exports.registerRoutes = function(express, pathToControllerTree, controllerPath) {
	if(controllerPath == null) {
		controllerPath = "./";
	} else if(typeof(controllerPath) != "string") {
		throw "Path must be a string or not included";
	}
	var controllers = loadControllers(controllerPath, {});
	buildRoutes(express, controllers, pathToControllerTree, "");
};

// ## The *getControllerUrl* function
// is the external API call that parses the path string in the
// ``controllerToPathHash`` and generates an *absolute for the server* URL
exports.getControllerUrl = function(controller, params) {
	var thePath = controllerToPathHash[controller];
	console.log(controllerToPathHash);
	console.log(controller);
	console.log(thePath);
	for(var param in params) {
		thePath = thePath.replace(new RegExp(":" + param + "\\?*", "g"), params[param]);
	}
	thePath = thePath.replace(/:[^\?]*\?/g, "");
	if(thePath.match(/:/)) {
		throw "Missing required parameter(s): " + thePath;
	}
	thePath = path.join("", thePath);
	return thePath;
};

// ## The *httpMethod* function
// is a convenience function to attach the ``httpMethod`` property to the
// given function. To be used by the controllers.js files.
exports.httpMethod = function(func, theMethod) {
	if(theMethod.match(/^(get|post|put|del|all)$/)) {
		func.httpMethod = theMethod;
	} else {
		throw "Invalid HTTP method name: " + theMethod + ". Should be one of: get, post, put, del, or all.";
	}
	return func;
};