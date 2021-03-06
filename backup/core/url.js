Air.Module('core.url', function(require){
	var router = require('core.router');
	var EVENTS = require('core.event');

	//window.onpopstate = function(event) {

	var api = {
		change : function(viewName, options){
			options    = options || {};
			var urlPath = api.getURLPath(viewName, options);
            if(urlPath){
	            var fromURL  = location.href;
	            var stateObj = {viewName: viewName};
              if (history.replaceState && history.pushState) {
  	            if(options.replace==true){
                      history.replaceState(stateObj, "viewName", urlPath);
  	            }else{
  	                history.pushState(stateObj, "viewName", urlPath);
  	            }
              }

	            beacon.on(EVENTS.URL_CHANGE, {
	            	from : fromURL,
	            	to   : urlPath
	            });


			}
		},

		getURLPath : function(viewName, options){
			options    = options || {};
            var params = options.params || {};
            var query  = options.query || "";
            var url;
            // detail/:id/:name/:price
            var routerRule = router.getRule(viewName);

            if(routerRule){
		        var urlPath = routerRule.replace(/:(\w+)/ig, function(param, key){
		                      return params[key] || ""
		            });

	            urlPath = urlPath.replace(/\/\/+/g,"/");
              if (!location.origin) {
                location.origin = location.protocol + "//" + location.hostname + (location.port ? ':' + location.port: '');
              }
	            url = location.origin + urlPath + query;

			}
			return url;
		}
	};

	return api;
})
