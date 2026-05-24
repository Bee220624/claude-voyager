// Claude Voyager page-world bridge
//
// 这个文件通过 manifest 的 content_scripts.world: "MAIN" 直接跑在 Claude 自己的页面世界，
// 而不是 content script 的 isolated world。
// 它只做一件事：把 window.__voyager 挂出去，所有方法转发到 isolated world 执行。
//
// 不要在这里写业务逻辑 —— 它无法访问 chrome.storage / extension API。

(function () {
  if (window.__voyager) return;
  function fire(action, arg) {
    document.dispatchEvent(
      new CustomEvent('voyager:diag-request', { detail: { action: action, arg: arg } }),
    );
  }
  window.__voyager = {
    diag: function () { fire('diag'); },
    harvest: function () { fire('harvest'); },
    showSidebar: function () { fire('showSidebar'); },
    showMenus: function () { fire('showMenus'); },
    showPanel: function () { fire('showPanel'); },
    showMessages: function () { fire('showMessages'); },
    fakeAdd: function (name) { fire('fakeAdd', name); },
    help: function () {
      console.log(
        '%c[Voyager] 可用命令:',
        'color:#c76946;font-weight:bold',
        '\n  __voyager.harvest()     — 采集本页未翻译的英文 UI 文字（汉化用，最常用）',
        '\n  __voyager.diag()        — 打印诊断 JSON',
        '\n  __voyager.showPanel()   — 高亮文件夹面板在屏幕上的实际位置',
        '\n  __voyager.showMessages() — 高亮时间轴检测到的消息并打印抽取文字',
        '\n  __voyager.showSidebar() — 高亮所有 sidebar 候选',
        '\n  __voyager.showMenus()   — 高亮当前打开的菜单',
        '\n  __voyager.fakeAdd(name) — 创建测试文件夹并加当前页',
      );
    },
  };
  console.log(
    '%c[Voyager] window.__voyager 已就绪。输入 __voyager.help() 查看命令。',
    'color:#c76946;font-weight:bold',
  );
})();
