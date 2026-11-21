//防复制
var url = window.location.href; if(url.indexOf("\u0077\u0075\u006c\u0069\u002e\u0077\u006b\u0065\u0070\u0075\u002e\u0063\u006f\u006d") < 0 ) { window.location.href="https://\u0077\u0075\u006c\u0069\u002e\u0077\u006b\u0065\u0070\u0075\u002e\u0063\u006f\u006d/"; }

document.onkeydown=function(){if(window.event&&window.event.keyCode==123){event.keyCode=0;event.returnValue=false;return false}else if((event.ctrlKey)&&(event.shiftKey)&&(event.keyCode==73)){event.keyCode=0;event.returnValue=false;return false}};window.oncontextmenu=function(e){e.preventDefault();}

document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

//演示模式
(function initPresentationMode() {
  var presBtn = document.getElementById('presentationBtn');
  var exitBtn = document.getElementById('presExitBtn');
  var body = document.body;
  if (!presBtn) return;
  function isFullscreen() {
    return !!(document.fullscreenElement ||
              document.webkitFullscreenElement ||
              document.msFullscreenElement);
  }
  function requestFS() {
    var el = document.documentElement;
    try {
      if (el.requestFullscreen)      return el.requestFullscreen();
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
      if (el.msRequestFullscreen)     return el.msRequestFullscreen();
    } catch (e) {}
    return Promise.resolve ? Promise.resolve() : null;
  }
  function exitFS() {
    try {
      if (document.exitFullscreen)      return document.exitFullscreen();
      if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
      if (document.msExitFullscreen)     return document.msExitFullscreen();
    } catch (e) {}
  }
  function redraw() {
    setTimeout(function () {
      window.dispatchEvent(new Event('resize'));
    }, 80);
  }
  function enter() {
  if (window.innerWidth <= 720) {
    alert('演示模式面向电脑/平板的大屏场景。手机屏幕较小，建议直接使用普通模式。');
    return;
  }
  if (!body.classList.contains('presentation-mode')) {
    body.classList.add('presentation-mode');
  }
  requestFS(document.documentElement);
  var card = document.querySelector('.experiment-card');
  if (card) card.scrollTop = 0;
  window.scrollTo(0, 0);
  redraw();
}

  function exit() {
    body.classList.remove('presentation-mode');
    if (isFullscreen()) exitFS();
    redraw();
  }
  presBtn.addEventListener('click', enter);
  if (exitBtn) exitBtn.addEventListener('click', exit);
  function onFsChange() {
    if (!isFullscreen() && body.classList.contains('presentation-mode')) {
      body.classList.remove('presentation-mode');
      redraw();
    }
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.addEventListener('MSFullscreenChange', onFsChange);
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.keyCode === 27) &&
        body.classList.contains('presentation-mode')) {
      exit();
    }
  });
    var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth <= 720 && body.classList.contains('presentation-mode')) {
        exit();
      }
    }, 200);
  });
})();

//统计
(function(){var config = {itv: 1800000,url1:'//ia.51.la/go1?id=21279793',ekc:''};!function(e){function t(r){if(n[r])return n[r].exports;var o=n[r]={exports:{},id:r,loaded:!1};return e[r].call(o.exports,o,o.exports,t),o.loaded=!0,o.exports}var n={};return t.m=e,t.c=n,t.p="",t(0)}([function(e,t,n){"use strict";function r(){var e=void 0,t=/id=(\d+)/.exec(config.url1)[1]||"";try{e=u.get("__tins__"+t)}catch(t){e=!1}var n=e&&i.isN(e.sid)&&i.isN(e.expires)&&g-e.sid<18e5?0:1,r=n?1:e.vd+1,o=n?g:e.sid,c=g+18e5;return u.set("__tins__"+t,s.stringify({sid:o,vd:r,expires:c}),null,"/"),[n,n?o:u.get("__tins__"+t).sid,r]}function o(){var e=s.parse(s.stringify(i.extend({},y,v))),t=i.obj2url(e),n=config.url1+"&rt="+g+"&"+t,r=new Image(1,1);r.src=n}var i=n(4),c=n(5),u=n(7).store,s=n(6),a=window,f=a.location,l=a.screen,p=a.navigator,g=i.now(),d=!0,m=r(),v={ekc:config.ekc,sid:m[1],tt:c.getMeta.tt,kw:c.getMeta.kw,cu:f.href,pu:c.getRef()},y={rl:l.width+"*"+l.height,lang:p.language||p.browserLanguage,ct:function(){var e=p.connection||p.mozConnection||p.webkitConnection||p.oConnection,t=i.hasIt(p.userAgent,"mobile")&&e?e.type:"unknow";return t}(),pf:function(){var e=d?1:0;return d=0,e}(),ins:m[0],vd:m[2],ce:p.cookieEnabled?1:0,cd:l.colorDepth||l.pixelDepth,ds:c.getMeta.ds};o.version="2.2.1.2",n(10)(y),o()},,,,function(e,t){"use strict";function n(e,t){return void 0!==e&&e.indexOf(t)!==-1}function r(e){return function(t){return Object.prototype.toString.call(t)==="[object "+e+"]"}}function o(){for(var e=0,t={};e<arguments.length;e++){var n=arguments[e];for(var r in n)t[r]=n[r]}return t}function i(e){return e.replace(/&/g,"~_~")}function c(e){var t="";for(var n in e)""!==t&&(t+="&"),t+=n+"="+a(a(i(String(e[n]))));return t}function u(e){return e.replace(/^\s+|\s+$/g,"")}function s(){return+new Date}var a=encodeURIComponent,f=r("Object"),l=r("Number"),p=r("String"),g=r("Array"),d=r("Function"),m=r("RegExp");e.exports={isO:f,isN:l,isF:d,isR:m,isS:p,isA:g,hasIt:n,extend:o,obj2url:c,trim:u,now:s}},function(e,t,n){"use strict";function r(e){return u.getElementsByTagName(e.toLowerCase())}function o(){var e="";try{e=c.top.document.referrer}catch(t){if(c.parent)try{e=c.parent.document.referrer}catch(t){e=""}}return""===e&&(e=u.referrer),e}var i=n(4),c=window,u=c.document,s=function(){var e=r("meta"),t=r("title"),n={kw:"",ds:""},o=void 0;n.tt=i.trim(t.length?t[0].innerHTML:"");for(var c=0;c<e.length;c++)e[c].name&&(o=e[c].name.toLowerCase(),i.hasIt("keywords",o)&&(n.kw=e[c].content.slice(0,100)),i.hasIt("description",o)&&(n.ds=e[c].content.slice(0,30)));return n}();e.exports={getMeta:s,getRef:o}},function(module,exports){"use strict";var _typeof="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};module.exports={parse:function parse(sJSON){return eval("("+sJSON+")")},stringify:function(){function e(o){if(null==o)return"null";if("number"==typeof o)return isFinite(o)?o.toString():"null";if("boolean"==typeof o)return o.toString();if("object"===("undefined"==typeof o?"undefined":_typeof(o))){if("function"==typeof o.toJSON)return e(o.toJSON());if(r(o)){for(var u="[",s=0;s<o.length;s++)u+=(s?", ":"")+e(o[s]);return u+"]"}if("[object Object]"===t.call(o)){var a=[];for(var f in o)n.call(o,f)&&a.push(e(f)+": "+e(o[f]));return"{"+a.join(", ")+"}"}}return'"'+o.toString().replace(c,i)+'"'}var t=Object.prototype.toString,n=Object.prototype.hasOwnProperty,r=Array.isArray||function(e){return"[object Array]"===t.call(e)},o={'"':'\\"',"\\":"\\\\","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t"},i=function(e){return o[e]||"\\u"+(e.charCodeAt(0)+65536).toString(16).substr(1)},c=/[\\"\u0000-\u001F\u2028\u2029]/g;return e}()}},function(e,t,n){"use strict";var r=n(5),o=n(6),i={get:function(e){return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*"+encodeURIComponent(e).replace(/[-.+*]/g,"\\$&")+"\\s*\\=s*([^;]*).*$)|^.*$"),"$1"))||null},set:function(e,t,n,r,o,i){if(!e||/^(?:expires|max-age|path|domain|secure)$/i.test(e))return!1;var c="";if(n)switch(n.constructor){case Number:c=n===1/0?"; expires=Fri, 31 Dec 9999 23:59:59 GMT":"; max-age="+n;break;case String:c="; expires="+n;break;case Date:c="; expires="+n.toUTCString()}return document.cookie=encodeURIComponent(e)+"="+encodeURIComponent(t)+c+(o?"; domain="+o:"")+(r?"; path="+r:"")+(i?"; secure":""),!0}},c={get:function(e){return o.parse((r.isMobi?window.localStorage.getItem(e):i.get(e))||"{}")},set:function(e,t,n,o){return r.isMobi?window.localStorage.setItem(e,t):i.set(e,t,n,o)}};e.exports={cookie:i,store:c}},,,function(e,t,n){"use strict";var r=n(4),o=n(7);e.exports=function(e){var t=o.store.get("__51laig__");t=r.isN(t)?parseInt(t)+1:1,o.cookie.set("__51cke__",config.ekc,null,"/"),e.ing=t,o.store.set("__51laig__",t,null,"/")}}]);}());

//反制措施
(function () {
  'use strict';
  var CONFIG = {
    sizeThreshold: 160,
    checkInterval: 800,
    enableDebuggerLoop: true,
    enableConsoleClear: true,
    enableRedirect: false,
    redirectUrl: 'about:blank',
    enableShortcutBlock: true,
    enableStopScript: true
  };
  var stopped = false;
  var debuggerTimer = null;
  var clearTimer = null;
  var checkTimer = null;
  function isDevToolsOpen() {
    var widthDiff = window.outerWidth - window.innerWidth;
    var heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > CONFIG.sizeThreshold || heightDiff > CONFIG.sizeThreshold) {
      return true;
    }
    var start = performance.now();
    debugger; 
    var end = performance.now();
    if (end - start > 100) {
      return true;
    }
    return false;
  }
  function startDebuggerLoop() {
    if (!CONFIG.enableDebuggerLoop || debuggerTimer) return;
    debuggerTimer = setInterval(function () {
      debugger;
    }, 50);
  }
  function startConsoleClear() {
    if (!CONFIG.enableConsoleClear || clearTimer) return;
    clearTimer = setInterval(function () {
      console.clear();
    }, 200);
  }
  function blockShortcuts() {
    if (!CONFIG.enableShortcutBlock) return;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C' || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.ctrlKey && (e.key === 'U' || e.keyCode === 85)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);
  }
  function stopScript() {
    if (!CONFIG.enableStopScript || stopped) return;
    stopped = true;
    throw new Error('Developer tools detected. Script execution stopped.');
  }
  function redirectPage() {
    if (!CONFIG.enableRedirect) return;
    try {
      window.location.href = CONFIG.redirectUrl;
    } catch (e) {}
  }
  function onDevToolsDetected() {
    if (stopped) return;
    stopped = true;
    startDebuggerLoop();
    startConsoleClear();
    redirectPage();
    stopScript();
  }
  function check() {
    if (stopped) return;
    if (isDevToolsOpen()) {
      onDevToolsDetected();
    } else {
      checkTimer = setTimeout(check, CONFIG.checkInterval);
    }
  }
  function init() {
    blockShortcuts();
    check();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ========== 分享二维码 ========== */
(function initShare() {
  var shareBtn = document.getElementById('shareBtn');
  var modal = document.getElementById('shareModal');
  var close = document.getElementById('shareClose');
  var qrBox = document.getElementById('shareQrBox');
  var urlBox = document.getElementById('shareUrl');
  if (!shareBtn || !modal || !qrBox) return;
  var qrGenerated = false;
  function openModal() {
    var url = window.location.href;
    if (!qrGenerated) {
      qrBox.innerHTML = '';
      try {
        if (typeof QRCodeGen === 'undefined') {
          throw new Error('QRCodeGen not loaded');
        }
        var matrix = QRCodeGen.generateQRCode({
          data: url,
          ecl: 'M',
          quietZone: 4
        });
        var svgString = QRCodeGen.renderToSVG(matrix, 220);
        qrBox.innerHTML = svgString;
        qrGenerated = true;
      } catch (e) {
        qrBox.innerHTML =
          '<div style="padding:20px;color:#7a8fa8;font-size:0.9rem;line-height:1.6;">' +
          '二维码生成失败<br>请刷新页面重试' +
          '</div>';
        qrGenerated = true;
      }
    }
    urlBox.textContent = url;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
  shareBtn.addEventListener('click', openModal);
  close.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.keyCode === 27) && modal.classList.contains('active')) {
      closeModal();
    }
  });
})();