(function () {
  'use strict';

  // Detect if running inside WeChat Mini Program webview
  let isMiniApp = false;
  try {
    isMiniApp = !!(window.__wxjs_environment === 'miniprogram' || navigator.userAgent.indexOf('miniProgram') >= 0);
  } catch (e) {}

  if (!isMiniApp) {
    // Fallback: check after WeixinJSBridge loads
    if (typeof WeixinJSBridge !== 'undefined') {
      WeixinJSBridge.invoke('getEnv', {}, function (res) {
        if (res && res.miniprogram) {
          initBridge(true);
        }
      });
    } else {
      document.addEventListener(
        'WeixinJSBridgeReady',
        function () {
          WeixinJSBridge.invoke('getEnv', {}, function (res) {
            if (res && res.miniprogram) {
              initBridge(true);
            }
          });
        },
        false
      );
    }
  } else {
    initBridge(true);
  }

  function initBridge(inMini) {
    if (!inMini) {
      return;
    }

    // Wait for wx global
    function waitForWx(cb, tries) {
      tries = tries || 0;
      if (typeof wx !== 'undefined' && wx.miniProgram) {
        cb();
        return;
      }
      if (tries < 50) {
        setTimeout(function () {
          waitForWx(cb, tries + 1);
        }, 200);
      }
    }

    waitForWx(function () {
      const navBar = createNavBar();
      document.body.insertBefore(navBar, document.body.firstChild);
      document.body.style.paddingTop = '44px';
      bindAssessmentEvents();
    });
  }

  function createNavBar() {
    const bar = document.createElement('div');
    bar.id = 'miniapp-nav-bar';
    bar.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:9999;height:44px;' +
      'background:#fff;border-bottom:1px solid #eee;display:flex;align-items:center;' +
      'padding:0 12px;box-shadow:0 1px 4px rgba(0,0,0,0.05);font-family:sans-serif;' +
      '-webkit-app-region:none;';

    const backBtn = document.createElement('div');
    backBtn.id = 'miniapp-back-btn';
    backBtn.style.cssText =
      'width:44px;height:44px;display:flex;align-items:center;' +
      'justify-content:flex-start;font-size:28px;color:#333;cursor:pointer;';
    backBtn.innerHTML = '&#8592;';
    backBtn.title = '返回上一题';

    const title = document.createElement('div');
    title.id = 'miniapp-title';
    title.style.cssText =
      'flex:1;text-align:center;font-size:15px;color:#333;' +
      'font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    title.textContent = '心理测评';

    const exitBtn = document.createElement('div');
    exitBtn.id = 'miniapp-exit-btn';
    exitBtn.style.cssText =
      'width:60px;height:44px;display:flex;align-items:center;' +
      'justify-content:flex-end;font-size:13px;color:#999;cursor:pointer;';
    exitBtn.innerHTML = '退出 &#10005;';
    exitBtn.title = '退出测评';

    bar.appendChild(backBtn);
    bar.appendChild(title);
    bar.appendChild(exitBtn);

    // Events
    backBtn.addEventListener('click', function () {
      handleBack();
    });
    exitBtn.addEventListener('click', function () {
      handleExit();
    });

    return bar;
  }

  function bindAssessmentEvents() {
    // Listen for assessment completion
    // The H5 calls window.__assessmentDone(scores, dimensions, scaleCode)
    window.__assessmentDone = function (scores, dimensions, scaleCode) {
      wx.miniProgram.postMessage({
        data: {
          event: 'assessment_done',
          data: {
            scaleCode: scaleCode || '',
            scores: scores,
            dimensions: dimensions
          }
        }
      });
      // Navigate away after a brief delay
      setTimeout(function () {
        wx.miniProgram.redirectTo({ url: '/pages/report/report' });
      }, 100);
    };

    // Auto-start assessment if URL has ?code=xxx&from=miniapp
    autoStartFromURL();
  }

  function autoStartFromURL() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const from = params.get('from');
    if (!code || from !== 'miniapp') {
      return;
    }

    function tryStart(tries) {
      tries = tries || 0;
      if (tries > 30) {
        return;
      }
      if (typeof SCALES === 'undefined' || !SCALES.length) {
        setTimeout(function () {
          tryStart(tries + 1);
        }, 300);
        return;
      }
      const scale = SCALES.find(function (s) {
        return s.code === code || s.id == code;
      });
      if (!scale) {
        return;
      }
      if (typeof _startAssessmentCore === 'function') {
        _startAssessmentCore(scale);
      }
    }
    setTimeout(tryStart, 600);
  }

  function handleBack() {
    // Try to go back one question in the H5 assessment
    // The assessment engine exposes goBack() or handles history
    try {
      if (typeof window.assessmentEngine !== 'undefined' && window.assessmentEngine.goBack) {
        window.assessmentEngine.goBack();
        return;
      }
    } catch (e) {}

    // Fallback: Try to trigger any existing back navigation
    const backEl = document.querySelector('[onclick*="goBack"]');
    if (backEl) {
      backEl.click();
      return;
    }

    // Last resort: go back to previous H5 page
    if (window.history && window.history.length > 1) {
      window.history.back();
    } else {
      handleExit();
    }
  }

  function handleExit() {
    if (confirm('确定要退出测评吗？已作答的题目将保留。')) {
      wx.miniProgram.postMessage({ data: { event: 'go_back' } });
      setTimeout(function () {
        wx.miniProgram.navigateBack();
      }, 200);
    }
  }
})();
