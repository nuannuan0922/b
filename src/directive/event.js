Air.Module('direcitve.event', function(require){
  var directive = require('core.directive'),
      node      = require('utility.node'),
      EVENTS    = require("core.event");

  directive.signup('event', 'ng-event');
  var reg = /(\((.*?)\))/;
  var api = function(target, $scope){
    if(!node(target).hasAttribute(directive.key.event)){
      return;
    }

    var cmd = target.getAttribute(directive.key.event);
    var eventName = cmd.match(/^\s*(\w+)\s+/)[1];

    beacon(target).once(eventName, function (e){
        //var eventCMD = this.getAttribute(directive.key.event).split(/\s/);
        var cmd = this.getAttribute(directive.key.event);
        var handleStr = cmd.replace(eventName,'')
        var eventHandle = handleStr.replace(reg,'').replace(/\s/g,'');
        var eventParam = handleStr.match(reg)[2]
        var params = eval("["+eventParam+"]");
        params.unshift(e);
        $scope.$event[eventHandle].apply(this, params);
        beacon.on(EVENTS.DATA_CHANGE, $scope);
    });

  }

  return api;
})
