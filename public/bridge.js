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
    exportCache: function () { fire('exportCache'); },
    mtStatus: function () { fire('mtStatus'); },
    showSidebar: function () { fire('showSidebar'); },
    showMenus: function () { fire('showMenus'); },
    showPanel: function () { fire('showPanel'); },
    showMessages: function () { fire('showMessages'); },
    fakeAdd: function (name) { fire('fakeAdd', name); },
    help: function () {
      console.log(
        '%c[Voyager] 可用命令:',
        'color:#c76946;font-weight:bold',
        '\n  __voyager.harvest()     — 采集本页未翻译的英文 UI 文字',
        '\n  __voyager.exportCache() — 导出端上翻译攒下的数据集（折进内置字典用）',
        '\n  __voyager.mtStatus()    — 查看端上翻译兜底状态',
        '\n  __voyager.diag()        — 打印诊断 JSON',
        '\n  __voyager.showPanel()   — 高亮文件夹面板位置',
        '\n  __voyager.showMessages() — 高亮时间轴检测到的消息',
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

  // ===== 端上机器翻译（Chrome Translator API，仅 MAIN world 可用）=====
  // 隔离世界的 mt.ts 通过 voyager:mt-request 发来一批英文，这里翻译后用 voyager:mt-response 回传。
  var translatorPromise = null;

  function createTranslator() {
    if (translatorPromise) return translatorPromise;
    translatorPromise = (async function () {
      if (typeof Translator === 'undefined') return null; // 老版本 Chrome / 不支持
      var targets = ['zh-Hans', 'zh'];
      for (var i = 0; i < targets.length; i++) {
        try {
          var opts = { sourceLanguage: 'en', targetLanguage: targets[i] };
          var avail = await Translator.availability(opts);
          if (avail === 'unavailable') continue;
          // downloadable / downloading / available 都尝试 create（会触发下载）
          return await Translator.create(opts);
        } catch (e) {
          /* 试下一个 target，或最终返回 null */
        }
      }
      return null;
    })();
    return translatorPromise;
  }

  // 创建翻译器在某些情况下需要用户手势；首个 pointerdown 时预热一次。
  window.addEventListener(
    'pointerdown',
    function () {
      createTranslator();
    },
    { once: true, capture: true },
  );

  document.addEventListener('voyager:mt-request', async function (e) {
    var detail = e.detail || {};
    var id = detail.id;
    var strings = detail.strings || [];
    var result = {};
    function respond(available, reason) {
      document.dispatchEvent(
        new CustomEvent('voyager:mt-response', {
          detail: { id: id, result: result, available: available, reason: reason },
        }),
      );
    }
    // 真不支持（老 Chrome / 非桌面）→ 永久信号
    if (typeof Translator === 'undefined') {
      respond(false, 'unsupported');
      return;
    }
    var translator = null;
    try {
      translator = await createTranslator();
    } catch (e2) {
      translator = null;
    }
    if (!translator) {
      // 多半是缺用户手势 / 模型下载中 → 可重试；清掉失败 promise 下次重建
      translatorPromise = null;
      respond(false, 'retry');
      return;
    }
    for (var i = 0; i < strings.length; i++) {
      var s = strings[i];
      try {
        result[s] = await translator.translate(s);
      } catch (e3) {
        /* 跳过这一条 */
      }
    }
    respond(true);
  });
})();
