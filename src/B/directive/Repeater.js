Air.Module('B.directive.Repeater', function(require) {
  var attrName = 'b-repeat';
  var util = require('B.util.util');

 Array.prototype.unshift = function(_unshift){
   return function(item){
     var lastValue = JSON.stringify(this[this.length-1]);
     this[this.lenght] = {};
     var result = _unshift.call(this,item);

    // // this.splice(0,0,item)
     if (lastValue){
       this[this.length -1] = JSON.parse(lastValue);
     }
     
     return this.length;
   }
 }(Array.prototype.unshift)

  function getTemplateStr(str, idx, dataPath, dataPrefix) {
    var reg = new RegExp("\\b\(" + dataPrefix + "\)\\b", 'g');
    // var repeatIndexREG = new RegExp('\\b' + dataPath + '\\[\\d+\\]\\.\\$index\\b');
    var repeatIndexREG = new RegExp('\\b' + dataPath + '\\.\\d+\\.\\$index\\b', 'g');
    var repeatIndexREG2 = new RegExp('{{\\b' + dataPath + '\\.\\d+\\.\\$index\\b}}', 'g');

    var result = str.replace(/\{\{.*?\}\}|b-show\s*=\s*"[^"]*?"|b-exist\s*=\s*"[^"]*?"|b-model\s*=\s*"[^"]*?"|b-property\s*=\s*"[^"]*"|b-repeat\s*=\s*"[^"]*"/g, function(tag) {
      // return tag.replace(reg, dataPath + '[' + idx + ']');
      return tag.replace(reg, dataPath + '.' + idx);
    });
    result = result.replace(repeatIndexREG2, idx);
    result = result.replace(repeatIndexREG, idx);

    return result;
  }


  function fixSelectElement(placeholder, target) {
    if (target.nodeName.toLowerCase() == 'option') {
      setTimeout(function() {
        placeholder.parentNode.value = placeholder.parentNode.initValue;
      }, 0);
    }
  }

  /**
   *作用：repeat模板控制器类
   *参数: <template> repeat模板引用.
   *参数: <scope> 当前 repeat 元素所处的作用域.
   *返回：Repeater 实例
   **/
  function Repeater(template, currentScopeIndex, scopeStructure, parseTemplate) {
    var scope = scopeStructure.scope;
    var uiElementCount = 0;
    var tag = generatePlaceholder(template);
    var expressionStr = template.getAttribute('b-repeat');
    var expressionREG = /(\S+)\s+in\s+(\S+)/;
    var expression = expressionStr.match(expressionREG) || [];
    var dataPath = expression[2];
    var dataPrefix = expression[1];
    var templateStr = template.outerHTML;
    var parentNode = template.parentNode;
    var childsTemplate = template.innerHTML;
    var containerTagName = parentNode.tagName.toLowerCase();
    parentNode.removeChild(template);
    var obj = {};

    function generatePlaceholder(target) {
      if (target.placeholder) {
        return target.placeholder;
      }
      var placeholder = document.createComment('repeat placeholder ' + target.getAttribute(attrName));
      target.parentNode.insertBefore(placeholder, target);
      target.placeholder = placeholder;
      return placeholder;
    }

    var getCount = function(path) {
      var data = util.getData(path || dataPath, scope) || [];
      var count = data.length || 0;
      return count;
    }

    var getDataPrefix = function() {
      return dataPrefix;
    }

    var addUI = function(num) {

      // var templateStr = template.outerHTML;

      var elementContent = '';
      var elementContainer = document.createDocumentFragment();
      var newFirstNode = null;
      var newNodeList = [];
      for (var i = 0; i < num; i++) {
        var uiIndex = uiElementCount + i;
        elementContent = getTemplateStr(templateStr, uiIndex, dataPath, dataPrefix);
        var docContainer = document.createElement(containerTagName);
        docContainer.innerHTML = elementContent;
        var targetNode = docContainer.firstChild;
        targetNode.removeAttribute('b-repeat');
        targetNode.$index = uiIndex;
        elementContainer.appendChild(targetNode);
        // newFirstNode = newFirstNode || ((i === 0) && targetNode);
        newNodeList.push(targetNode)
      }

      // 如果是 select 变动，则将 option 赋值后恢复 select 的选中值
      var isSelect = containerTagName === 'select';
      var initValue;
      var parentNode = tag.parentNode;
      if (isSelect) {
        initValue = parentNode.initValue;
      }

      parentNode.insertBefore(elementContainer, tag);

      if (isSelect) {
        setTimeout(function(){
          parentNode.value = initValue;
        }, 0);
      }

      fixSelectElement(tag, targetNode)
      elementContainer = null;
      docContainer = null;
      uiElementCount += num;
      return newNodeList;
    }

    var getPreviousElement = function(elm) {
      var e = elm.previousSibling;
      while (e && 1 !== e.nodeType) {
        e = e.previousSibling;
      }
      return e;
    }

    var removeUI = function(num) {
      num = Math.abs(num);
      for (var i = 0; i < num; i++) {
        var previousSibling = getPreviousElement(tag);
        if (previousSibling) {
          tag.parentNode.removeChild(previousSibling);
        }
      }
      uiElementCount -= num;
    }

    var updateUI = function(path) {
      var repeatCount = getCount(path);
      var num = repeatCount - uiElementCount;
      var isRemove = num < 0;
      var isAdd = num > 0;
      isRemove && removeUI(num);
      var newFirstNode = isAdd && addUI(num);
      return newFirstNode;
    }

    var descriptorList = [];

    /**
     *作用：监听 repeat 元素数据源变动
     *参数: <repeater> repeat ui 控制器
     *参数: <dataPath> 数据源路径
     *返回：undefind
     **/
    function bindRepeatData(repeater, dataPath, isinit) {
      var activePath = '';
      var pathNodes = dataPath.split('.') || [];
      // (template, currentScopeIndex, scopeStructure, parseTemplate)
      for (var i = 0; i < pathNodes.length; i++) {
        // var nextPathNode = pathNodes.shift();
        var nextPathNode = pathNodes[i];

        var activeObj = activePath ? util.getData(activePath, scope) : scope;
        activeObj = activeObj || Air.NS(activePath, scope);
        var nextObj = nextPathNode && util.getData(nextPathNode, activeObj);

        // 如果之前绑定过，缓存起来，供 descriptor 回调
        var existDescriptor = Object.getOwnPropertyDescriptor(activeObj, nextPathNode);
        if (existDescriptor && existDescriptor.get && (descriptorList.indexOf(existDescriptor)<0)) {
          descriptorList.push(existDescriptor);
        }

        if (isinit) {
          beacon(scope).on('updateRepeatData' + (pathNodes.slice(0, i + 1).join('')), function(e, args){
            bindRepeatData(api, args.dataPath);
            args.callback && args.callback();
          })
        }

        var descriptor = createRepeatDataDescriptor.call(activeObj, repeater, nextObj, pathNodes.slice(0, i + 1).join('.'));
        (typeof activeObj === 'object' && !(i !== pathNodes.length - 1 && existDescriptor && existDescriptor.get)) && Object.defineProperty(activeObj, nextPathNode, descriptor);
        activePath = nextPathNode && activePath ? (activePath + '.' + nextPathNode) : nextPathNode;
      }
    }


    function fixUnshift(val, value, descriptor){
      value.unshift =  function(item){
          //  var lastValue = value.slice(0);
           var result = [].concat(item, this)
         descriptor.set( [] );
         descriptor.set( [].concat(result));
         console.log(result,"**************************")
        // descriptor.set(result);
         return result
       }

    }

    /**
     *作用：创建 repeat 数据源的描述符
     *参数: <repeater> 模板 UI 控制器.
     *参数: <scope> 模板当前所处作用域.
     *返回：repeat 数据源的描述符
     **/
    function createRepeatDataDescriptor(repeater, value, dataPath) {
      var oldLength = 0;
      value = value || [];
      var descriptor = {
        enumerable: true,
        configurable: true,
        get: function() {


          // 数组push操作等，会触发get，此时拿到的length是push之前的，所以要延迟
          setTimeout(function() {
            var length = value && value.length || 0;
            if (oldLength !== length) {
              var nodes = repeater.updateUI();
              // node && parseTemplate(node, currentScopeIndex);
              for (var i = 0; i < nodes.length; i++) {
                var activeNode = nodes[i];
                activeNode && parseTemplate(activeNode, currentScopeIndex, currentScopeIndex)
              }

              for (var i = 0; i < descriptorList.length; i++) {
                descriptorList[i] && descriptorList[i].get && descriptorList[i].get();
              }
            }
            oldLength = length;
          }, 0);
          return value;
        },

        set: function(val, isSub) {
          var hasChanged = value !== val;

          if (!val) {
            val = beacon.utility.isType(value, 'Array') ? [] : {};
          }

          var isArray = beacon.utility.isType(val, 'Array');
          var isObject = beacon.utility.isType(val, 'Object');

          if (!hasChanged) {
            return;
          }

          if (isObject) {
            value = value || {};


            for(var key in value){
              if(!val[key]){
                val[key] = undefined;
              }
            }

            for (var key in value) {
              var existDescriptor = Object.getOwnPropertyDescriptor(value, key);
              if (!(existDescriptor && existDescriptor.get)) {
                // var descriptor = createRepeatDataDescriptor.call(activeObj, repeater, nextObj, pathNodes.slice(0, i + 1).join('.'));
                // Object.defineProperty(activeObj, nextPathNode, descriptor);
                if (beacon.utility.isType(value[key], 'Array')) {
                  bindRepeatData(repeater, dataPath + '.' + key, true);
                } else if (beacon.utility.isType(value[key], 'Object')) {
                  beacon.on('updateObjectData',{
                    currentScopeIndex: currentScopeIndex,
                    dataPath : dataPath + '.' + key
                  })
                }
              }
            }


            // 子回调不赋值，只处理 dom
            if (!isSub) {
              beacon.utility.merge(value, val);
            }
          } else if (isArray) {
            value = value || [];

            fixUnshift(val, value, descriptor);

            // 子回调不赋值，只处理 dom
            if (!isSub) {
              var oldLen = value.length;
              var newLen = val.length;
              if (val.length===0){
                value.splice(0);
              }else{


                for(var key in value){
                  var keyNum = parseInt(key, 10);
                  var isNumKey = beacon.utility.isType(keyNum, 'Number') && !isNaN(keyNum);
                  if(!isNumKey && !val[key]){
                    val[key] = undefined;
                  }
                  

                }
              }
              if (newLen < oldLen) {
                value.splice(newLen - oldLen, oldLen - newLen);
              }

              oldLength = newLen;

              
              beacon.utility.merge(value, val);
            }

            var nodes = repeater.updateUI();
            for (var i = 0; i < nodes.length; i++) {
              var activeNode = nodes[i];
              activeNode && parseTemplate(activeNode, currentScopeIndex, currentScopeIndex)
            }

            // for (var i = 0; i < descriptorList.length; i++) {
            //   if (this !== descriptorList[i]) {
            //     descriptorList[i] && descriptorList[i].set && descriptorList[i].set(val, true);
            //   }
            // }

          } else {
            value = val;
          }



          // for (var i = 0; i < descriptorList.length; i++) {
          //   descriptorList[i] && descriptorList[i].set && descriptorList[i].set(val, true);
          // }

          //test start
          // fn();
          // function fn(){
          //   var index = 0;
          //   var step = 10;
          //   setTimeout(fnProxy,30);

          //   function fnProxy(){
          //     index += step;
          //     for (var i = 0; i < index; i++) {
          //       descriptorList[i] && descriptorList[i].set && descriptorList[i].set(val, true);
          //     }
          //     setTimeout(fnProxy,30);
          //   }
          // }


          //test end

        }
      }
      return descriptor;
    }

    var api = {
      updateUI: updateUI,
      getDataPrefix: getDataPrefix
    }


    bindRepeatData(api, dataPath, true);

    return api;
  }

  return Repeater;
});
