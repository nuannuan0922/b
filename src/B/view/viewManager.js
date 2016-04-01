Air.Module("B.view.viewManager", function(require){
  var View = require("B.view.View");
  var router = require('B.router.router');
  var HTTP   = require('B.network.HTTP');
  var memCache = require('B.data.memCache');
  var scopeManager = require('B.scope.scopeManager');
  var EVENTS =  require('B.event.events');
  var middleware = require('B.util.middleware');
  var viewList = [],
      viewportList = [],
      activeView = null,
      mainViewport = null;
  var lastView = null;

  /**
   * 初始化首屏 View
   */
  function init(env){
    scopeManager.setRoot(env);
    initLocalViewport();
    var URLPath = location.pathname;
    var activeRouter = router.getMatchedRouter(URLPath);
    if (activeRouter) {
      goTo(activeRouter.viewName, {
        replace: true,
        params: activeRouter.params,
        query: location.search
      });
    } else {
      throw404();
    }
    listenURLChange();
  }

  function initLocalViewport(){
    var viewports = document.querySelectorAll('viewport');
    var viewportIndex = 0;
    var viewportCount = viewports.length;
    for(; viewportIndex < viewportCount; viewportIndex++){
      var activeViewport = viewports[viewportIndex];
      var isMainViewport = (activeViewport.getAttribute('main')==='true');
      var activeViewportInfo = {
        dom : activeViewport,
        views : []
      };
      viewportList.push(activeViewportInfo);
      isMainViewport && setMainViewport(activeViewportInfo);
      initLocalView(activeViewportInfo);
    }
  }

  function appendView(viewName, view) {
    mainViewport.dom.appendChild(view.getDom());
    mainViewport.views[viewName] = view;
  }

  function setMainViewport(viewport){
    mainViewport = viewport;
  }

  function initLocalView(viewContainer){
    var viewport = viewContainer.dom;
    var views = viewport.children;
    var viewIndex = 0;
    var viewCount = views.length;
    for(; viewIndex < viewCount; viewIndex++){
      var activeView = views[viewIndex];

      // 兼容 IE8 自定义tab
      // TODO: 验证|| activeView.tagName.toLowerCase() === 'cjia:view' 是否冗余判断
      if (activeView.tagName.toLowerCase() === 'view' || activeView.tagName.toLowerCase() === 'cjia:view') {
        var activeViewName = activeView.getAttribute('name');
        var view = new View(activeViewName, activeView)
        viewContainer['views'][activeViewName] = view;
        scopeManager.parseScope(activeViewName, view.getDom());
      }
    }
  }



  function goTo (viewName, options){
    var fnName = 'beforeGoTo';
    var paramObj = { viewName: viewName };
    var next = function(){
      var hasView = getViewByViewName(viewName);
      if (hasView) {
        saveLastView();
        switchURL(viewName, options);
        changeURLParams(viewName, options);
        show(viewName);
      } else {
        loadView(viewName, options);
      }
    }

    // goTo 方法对外支持中间件，中间件参数为 paramObj
    middleware.run(fnName, paramObj, next);
  }

  function changeURLParams(viewName, options) {
    options = options || {};
    var $scope = scopeManager.getScope(viewName);
    $scope['$request'] = $scope.$request || {};
    $scope.$request.params = options.params;
  }

  function switchURL (viewName, options) {
    options = options || {};
    var fromUrl = location.href;
    var url = router.getURLPathByViewName(viewName, {
      params: options.params,
      query: options.query
    });


    // TODO: 兼容IE8、IE9 url 变化，计划采用锚点方案
    var isReplace  = options.replace;
    var changeURLState = isReplace ? history.replaceState : history.pushState;
    changeURLState && changeURLState.call(history, {
      viewName: viewName,
      params: options.params
    }, viewName, url);


    var fnName = 'afterURLChange';
    var paramObj = {
      from: fromUrl,
      to: url
    };
    // switchURL 方法对外支持中间件，中间件参数为 paramObj
    middleware.run(fnName, paramObj);
  }

  function listenURLChange() {
    beacon(window).on('popstate', function(e){
      var state  = e.state || {};
      saveLastView();
      if (state.viewName) {
        var hasView = getViewByViewName(state.viewName);
        if (hasView) {
          show(state.viewName);
        } else {
          var URLPath = location.pathname;
          var activeRouter = router.getMatchedRouter(URLPath);
          if (activeRouter) {
            goTo(activeRouter.viewName, {
              replace: true,
              params: activeRouter.params,
              query: location.search
            });
          } else {
            throw404();
          }
        }
      }
    });
  }

  function back () {
    window.history.back();
  }

  function show (viewName){
    var view = getViewByViewName(viewName);
    if (view) {
      view.parseSrc();
      switchView(view);
    } else {
      throw404();
    }
  }


  function throw404(){
    var fnName = 'viewNotFound';
    middleware.run(fnName);
  };

  function getViewByViewName(viewName){
    return mainViewport.views[viewName];
  }

  function getScopeKeyByViewName(viewName) {
    var viewDom = activeView.getDom().querySelector('view[name="' + viewName + '"]');

    return viewDom && viewDom.getAttribute('b-scope-key') || '';
  }

  function loadView(viewName, options){
    showLoading();
    var env = memCache.get('env');
    var curRouter = router.get(viewName);
    var sign = curRouter.sign || '';
    var extPath = sign ? '_' + sign : '';
    var templatePath = env.$templatePath + viewName + extPath + '.html';
    var http = new HTTP();

    http.get(templatePath, {
      successCallBack : successCallBack,
      errorCallBack : errorCallBack
    });

    function successCallBack(xhr){
      var responseText = xhr.responseText;
      // 2
      var view = new View(viewName, responseText, {
        initCallback: function(){
          hideLoading();
        }
      });
      var scope = scopeManager.parseScope(viewName, view.getDom());
      changeURLParams(viewName, options);
      appendView(viewName, view);

      saveLastView();
      setActive(view);

      // 3
      beacon(scope).once(EVENTS.RUN_COMPLETE, function(){
        // 6
        switchURL(viewName, options);
        show(viewName);
      });
    }

    function errorCallBack(){
      throw404();
    }
  }

  function saveLastView() {
    lastView = getActive();
  }

  function setActive(view) {
    activeView = view;
  }

  function switchView(view){
    // if(activeView === view){return};
    // 7
    if (lastView) {
      var lastViewName = lastView.getViewName();
      lastView && lastView.hide();
      beacon(lastView).on(lastView.events.onHide, {
        to: view
      });
      var $lastScope = scopeManager.getScope(lastViewName);
      beacon($lastScope).on(EVENTS.DATA_CHANGE);
    }

    activeView = view;
    activeView.show();
    beacon(activeView).on(activeView.events.onShow, {
      from: lastViewName
    });
    var $scope = scopeManager.getScope(view.getViewName());
    beacon($scope).on(EVENTS.DATA_CHANGE);
  }

  function hide(viewName){
    var view = getViewByViewName(viewName);
    view && view.hide();
  }

  function createView(){}

  function showLoading(){}

  function hideLoading(){}

  function getActive(){
    return activeView;
  }

  api = {
    init : init,
    goTo : goTo,
    back : back,
    addMiddleware : middleware.add,
    removeMiddleware : middleware.remove,
    showLoading : showLoading,
    hideLoading : hideLoading,
    getActive : getActive,
    getScopeKeyByViewName: getScopeKeyByViewName
  }

  return api;
});
