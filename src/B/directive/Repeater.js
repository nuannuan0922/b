Air.Module('B.directive.Repeater', function(require) {
  var attrName = 'b-repeat';
  var util = require('B.util.util');


  function getTemplateStr(str, idx, dataPath, dataPrefix) {
    var reg = new RegExp("\\b\(" + dataPrefix + "\)\\b", 'g');
    // var repeatIndexREG = new RegExp('\\b' + dataPath + '\\[\\d+\\]\\.\\$index\\b');
    var repeatIndexREG = new RegExp('\\b' + dataPath + '\\.\\d+\\.\\$index\\b', 'g');
    var repeatIndexREG2 = new RegExp('{{\\b' + dataPath + '\\.\\d+\\.\\$index\\b}}', 'g');

    var result = str.replace(/\{\{.*?\}\}|b-show\s*=\s*".*?"|b-model\s*=\s*".*?"|b-property\s*=\s*".*"|b-repeat\s*=\s*".*"/g, function(tag) {
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
    var containerTagName = parentNode.tagName.toLowerCase();
    parentNode.removeChild(template);

    function generatePlaceholder(target) {
      if (target.placeholder) {
        return target.placeholder;
      }
      var placeholder = document.createComment('repeat placeholder ' + target.getAttribute(attrName));
      target.parentNode.insertBefore(placeholder, target);
      target.placeholder = placeholder;
      return placeholder;
    }

    var getCount = function() {
      var data = util.getData(dataPath, scope) || [];
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

    var updateUI = function() {
      var repeatCount = getCount();
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
    function bindRepeatData(repeater, dataPath) {
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
        if (existDescriptor) {
          descriptorList.push(existDescriptor);
        };

        var descriptor = createRepeatDataDescriptor.call(activeObj, repeater, nextObj);
        Object.defineProperty(activeObj, nextPathNode, descriptor);
        activePath = nextPathNode && activePath ? (activePath + '.' + nextPathNode) : nextPathNode;
      }
    }

    /**
     *作用：创建 repeat 数据源的描述符
     *参数: <repeater> 模板 UI 控制器.
     *参数: <scope> 模板当前所处作用域.
     *返回：repeat 数据源的描述符
     **/
    function createRepeatDataDescriptor(repeater, value) {
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

            // 子回调不赋值，只处理 dom
            if (!isSub) {
              beacon.utility.merge(value, val);
            }
          } else if (isArray) {
            value = value || [];

            // 子回调不赋值，只处理 dom
            if (!isSub) {
              var oldLen = value.length;
              var newLen = val.length;

              if (newLen < oldLen) {
                value.splice(newLen - oldLen, oldLen - newLen);
                oldLength = newLen;
              }

              for(var key in value){
                var keyNum = parseInt(key, 10);
                var isNumKey = beacon.utility.isType(keyNum, 'Number') && !isNaN(keyNum);
                if(!isNumKey && !val[key]){
                  val[key] = undefined;
                }
              }

              beacon.utility.merge(value, val);
            }

            var nodes = repeater.updateUI();
            for (var i = 0; i < nodes.length; i++) {
              var activeNode = nodes[i];
              activeNode && parseTemplate(activeNode, currentScopeIndex, currentScopeIndex)
            }
          }

          for (var i = 0; i < descriptorList.length; i++) {
            descriptorList[i] && descriptorList[i].set && descriptorList[i].set(val, true);
          }

        }
      }
      return descriptor;
    }

    var api = {
      updateUI: updateUI,
      getDataPrefix: getDataPrefix
    }

    bindRepeatData(api, dataPath);

    return api;
  }

  return Repeater;
});