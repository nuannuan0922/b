Air.Module('B.directive.model', function(require){
  var nodeUtil  = require('B.util.node'),
      util      = require('B.util.util'),
      EVENTS    = require("B.event.events");
  var attrName = 'b-model';
  var api = function(target, $scope){
      var activeModel = null;
      if(!nodeUtil(target).hasAttribute(attrName)){
        return;
      }
      var dataPath = target.getAttribute(attrName)
                     .replace(/{{|}}/ig,'');

      function onInput(e){
        var target = this;
        var value = target.type==='checkbox' ?  target.checked : target.value;
        new Function('$scope','value','$scope.' + dataPath + '= value')($scope, value)
        // activeModel = true;
        // beacon($scope).on(EVENTS.DATA_CHANGE, {fromBModel:true});
        // activeModel = false;

        var removedEvent = e.type === 'input' ? 'change' : 'input';
        beacon(target).off(removedEvent, onInput);
      }

      beacon(target).on('input', onInput);
      beacon(target).on('change', onInput);

      // beacon($scope).on(EVENTS.DATA_CHANGE, modelChangeHandle);
      $scope.listenDataChange(dataPath, modelChangeHandle)
      function modelChangeHandle(){
        var value = util.getData(dataPath, $scope);
        if(target.value === value && target.type!=="radio"){return};
        var result = !util.isEmpty(value) ? value : "";

        if(target.value !== value ||target.type=="radio" ) {
         target.initValue = result;
         if (target.type !== 'file') {



           //TODO: 此处代码修改匆忙，择日重构
           if(target.type=="radio" ){
            target.checked = target.value == result;
           } else {
             target.checked = result;
             target.value = result;
           }


         }
        }
      }
  }
  return api;
})
