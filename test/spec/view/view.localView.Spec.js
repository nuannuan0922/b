// history.pushState = function(){location.hash = new Date()}
// history.replaceState = function(){location.hash = new Date()}
describe('模板内嵌 view ', function () {

  it(' 初始化 ', function () {

    // 模板 HTML 元素选择器
    var selector = {
      activeView : 'viewport[main=true] view[active=true]'
    }
    var env = {
      templatePath : 'http://127.0.0.1:8000/test/page_template/',
      resourceURL  : 'http://static.cjia.com/resource',
      moduleURL    : 'http://static.cjia.com/module'
    }

    b.init(env);

    // 模板 HTML元素引用
    var activeView  = document.querySelector(selector.activeView)
    var activeViewContent = activeView.querySelector('p')
    expect(activeViewContent.innerText).toEqual('Hello');

  }); // view 初始化完成

  it('前进', function () {
    // 切换至列表页
    b.views.goto('page_list');
    var activeView = b.views.getActive();
    var activeViewName = activeView.getViewName();
    expect(activeViewName).toEqual('page_list');
  });// 切换 完成


  it('后退', function (done) {
    b.views.goto('page_detail');
    b.views.back();

    var activeView = b.views.getActive();
    beacon(activeView).once(activeView.events.onHide, function(e, data) {
      var toView = data.to;
      beacon(toView).once(toView.events.onShow, function(e) {
        // 模板 HTML元素引用
        var activeView = b.views.getActive();
        var activeViewName = activeView.getViewName();
        expect(activeViewName).toEqual('page_list');
        done();
      });
    });
  }); // 后退 完成

}); // 本地 view 初始化 over
