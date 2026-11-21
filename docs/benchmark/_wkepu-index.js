  (function() {
    (function initIntroToggle() {
      var introText = document.getElementById('introText');
      var introToggle = document.getElementById('introToggle');
      if (!introText || !introToggle) return;
      var toggleTextEl = introToggle.querySelector('.toggle-text');
      introToggle.addEventListener('click', function() {
        var isExpanded = introText.classList.toggle('expanded');
        introToggle.classList.toggle('expanded', isExpanded);
        introToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        if (toggleTextEl) {
          toggleTextEl.textContent = isExpanded ? '收起简介' : '展开查看简介';
        }
      });
      function handleResize() {
        if (window.innerWidth > 600) {
          introText.classList.add('expanded');
          introToggle.classList.remove('expanded');
          introToggle.setAttribute('aria-expanded', 'true');
          if (toggleTextEl) toggleTextEl.textContent = '收起简介';
        } else {
          introText.classList.remove('expanded');
          introToggle.classList.remove('expanded');
          introToggle.setAttribute('aria-expanded', 'false');
          if (toggleTextEl) toggleTextEl.textContent = '展开查看简介';
        }
      }
      handleResize();
      var resizeTimer = null;
      window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleResize, 150);
      });
    })();
    var experiments = [
      { id: 1,  name: "平面镜成像",             category: "光学" },
      { id: 2,  name: "光的反射定律",           category: "光学" },
      { id: 3,  name: "光的折射规律",           category: "光学" },
      { id: 4,  name: "凸透镜成像规律",         category: "光学" },
      { id: 5,  name: "测量平均速度",           category: "力学" },
      { id: 6,  name: "测量固体的质量",         category: "力学" },
      { id: 7,  name: "测量固体的密度",         category: "力学" },
      { id: 8,  name: "探究真空能否传声",       category: "声学" },
      { id: 9,  name: "探究液体内部压强",       category: "力学" },
      { id: 10, name: "探究影响浮力大小的因素", category: "力学" },
      { id: 11, name: "探究杠杆平衡条件",       category: "力学" },
      { id: 12, name: "探究滑轮组的特点",       category: "力学" },
      { id: 13, name: "探究使用机械是否省功",   category: "力学" },
      { id: 14, name: "探究定滑轮的特点",       category: "力学" },
      { id: 15, name: "探究动滑轮的特点",       category: "力学" },
      { id: 16, name: "探寻连通器的特点",       category: "力学" },
      { id: 17, name: "用吸盘测大气压",         category: "力学" },
      { id: 18, name: "用注射器测大气压",       category: "力学" },
      { id: 19, name: "探究水沸腾时的特点",     category: "热学" },
      { id: 20, name: "探究晶体熔化的特点", category: "热学" },
      { id: 21, name: "探究影响动能大小的因素", category: "力学" },
      { id: 22, name: "探究影响重力势能大小的因素", category: "力学" },
      { id: 23, name: "探究改变内能的方式", category: "热学" },
      { id: 24, name: "比较不同物质的吸热情况", category: "热学" },
      { id: 25, name: "探究电荷间相互作用的规律", category: "电磁学" },
      { id: 26, name: "探究串并联电路中电流的特点", category: "电磁学" },
      { id: 27, name: "探究不同物质的导电性能", category: "电磁学" },
      { id: 28, name: "探究串并联电路中电压的特点", category: "电磁学" },
      { id: 29, name: "探究影响电阻大小的因素", category: "电磁学" },
      { id: 30, name: "探究电流与电压的关系", category: "电磁学" },
      { id: 31, name: "探究电流与电阻的关系", category: "电磁学" },
      { id: 32, name: "探究产生感应电流的条件", category: "电磁学" }
    ];
    var CATEGORIES = ["全部", "光学", "力学", "声学", "热学", "电磁学"];
    function getCategoryClass(cat) {
      switch (cat) {
        case '光学':   return 'optics';
        case '力学':   return 'mechanics';
        case '热学':   return 'thermals';
        case '电磁学': return 'electromag';
        default:       return '';
      }
    }
    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function normalizeWithMap(str) {
      var map = [];
      var norm = '';
      var re = /[\s\-_·、,，.。()（）【】\[\]\/\\]/;
      for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        if (re.test(ch)) continue;
        norm += ch.toLowerCase();
        map.push(i);
      }
      return { norm: norm, map: map };
    }
    function matchExperiment(exp, rawQuery) {
      if (!rawQuery) return { matched: true, score: 0, indexes: [] };
      var kwNorm = normalizeWithMap(rawQuery).norm;
      if (!kwNorm) return { matched: true, score: 0, indexes: [] };
      var nameInfo = normalizeWithMap(exp.name);
      var nameNorm = nameInfo.norm;
      var hitIndex = nameNorm.indexOf(kwNorm);
      if (hitIndex !== -1) {
        var indexes = [];
        for (var k = 0; k < kwNorm.length; k++) indexes.push(nameInfo.map[hitIndex + k]);
        return { matched: true, score: 1000 - hitIndex * 2, indexes: indexes };
      }
      var cursor = 0, idxs = [], ok = true;
      for (var m = 0; m < kwNorm.length; m++) {
        var found = nameNorm.indexOf(kwNorm.charAt(m), cursor);
        if (found === -1) { ok = false; break; }
        idxs.push(nameInfo.map[found]);
        cursor = found + 1;
      }
      if (ok) {
        var span = idxs[idxs.length - 1] - idxs[0];
        return { matched: true, score: 500 - span * 2 - idxs[0], indexes: idxs };
      }
      return { matched: false, score: 0, indexes: [] };
    }
    function highlightByName(name, indexes) {
      if (!indexes || !indexes.length) return escapeHtml(name);
      var set = {};
      for (var i = 0; i < indexes.length; i++) set[indexes[i]] = true;
      var out = '';
      for (var j = 0; j < name.length; j++) {
        var ch = escapeHtml(name.charAt(j));
        out += set[j] ? '<mark>' + ch + '</mark>' : ch;
      }
      return out;
    }
    var grid        = document.getElementById('expGrid');
    var searchInput = document.getElementById('expSearch');
    var clearBtn    = document.getElementById('searchClear');
    var chipsBox    = document.getElementById('filterChips');
    var tipBox      = document.getElementById('searchTip');
    if (!grid) return;
    var currentCategory = '全部';
    (function renderChips() {
      if (!chipsBox) return;
      var used = CATEGORIES.filter(function(c) {
        return c === '全部' || experiments.some(function(e) { return e.category === c; });
      });
      chipsBox.innerHTML = used.map(function(c) {
        return '<button type="button" class="chip' + (c === '全部' ? ' active' : '') +
               '" data-cat="' + escapeHtml(c) + '" role="tab" aria-selected="' +
               (c === '全部') + '">' + escapeHtml(c) + '</button>';
      }).join('');
      chipsBox.addEventListener('click', function(e) {
        var btn = e.target.closest ? e.target.closest('.chip') : null;
        if (!btn) return;
        currentCategory = btn.getAttribute('data-cat');
        var all = chipsBox.querySelectorAll('.chip');
        for (var i = 0; i < all.length; i++) {
          var isActive = all[i] === btn;
          all[i].classList.toggle('active', isActive);
          all[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
        applyFilter();
      });
    })();
    function renderResults(list, keyword) {
      if (!list.length) {
        grid.innerHTML =
          '<div class="empty-state">' +
            '<span class="empty-icon" aria-hidden="true">🔍</span>' +
            '<p>没有找到与 <strong>“' + escapeHtml(keyword || '当前条件') + '”</strong> 匹配的实验</p>' +
            '<button type="button" class="empty-reset" id="emptyReset">清空搜索条件</button>' +
          '</div>';
        var resetBtn = document.getElementById('emptyReset');
        if (resetBtn) {
          resetBtn.addEventListener('click', function() {
            searchInput.value = '';
            currentCategory = '全部';
            var all = chipsBox ? chipsBox.querySelectorAll('.chip') : [];
            for (var i = 0; i < all.length; i++) {
              var isAll = all[i].getAttribute('data-cat') === '全部';
              all[i].classList.toggle('active', isAll);
              all[i].setAttribute('aria-selected', isAll ? 'true' : 'false');
            }
            applyFilter();
            if (searchInput.focus) searchInput.focus();
          });
        }
        return;
      }
      var htmlStr = '';
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var exp = item.exp;
        var catClass = getCategoryClass(exp.category);
        htmlStr +=
          '<div class="exp-card ' + catClass + '" role="listitem">' +
            '<div class="exp-number">#' + String(exp.id).padStart(2, '0') + '</div>' +
            '<div class="exp-name">' +
              '<a href="https://wuli.wkepu.com/' + exp.id + '.html" rel="noopener">' +
                highlightByName(exp.name, item.indexes) +
              '</a>' +
            '</div>' +
            '<div class="exp-category">' + escapeHtml(exp.category) + '</div>' +
          '</div>';
      }
      grid.innerHTML = htmlStr;
    }
    function applyFilter() {
      var keyword = searchInput ? searchInput.value.trim() : '';
      if (clearBtn) clearBtn.hidden = keyword.length === 0;
      var results = [];
      for (var i = 0; i < experiments.length; i++) {
        var exp = experiments[i];
        if (currentCategory !== '全部' && exp.category !== currentCategory) continue;
        var m = matchExperiment(exp, keyword);
        if (!m.matched) continue;
        results.push({ exp: exp, score: m.score, indexes: m.indexes });
      }
      results.sort(function(a, b) {
        return (b.score - a.score) || (a.exp.id - b.exp.id);
      });
      renderResults(results, keyword);
      if (tipBox) {
        if (!keyword && currentCategory === '全部') {
          tipBox.hidden = true;
          tipBox.innerHTML = '';
        } else {
          tipBox.hidden = false;
          tipBox.innerHTML =
            '找到 <strong>' + results.length + '</strong> 个实验' +
            (keyword ? '（关键词：<strong>' + escapeHtml(keyword) + '</strong>）' : '') +
            (currentCategory !== '全部' ? '（类别：<strong>' + escapeHtml(currentCategory) + '</strong>）' : '') +
            ' <button type="button" class="reset-link" id="tipReset">重置</button>';
          var tipReset = document.getElementById('tipReset');
          if (tipReset) {
            tipReset.addEventListener('click', function() {
              searchInput.value = '';
              currentCategory = '全部';
              var all = chipsBox ? chipsBox.querySelectorAll('.chip') : [];
              for (var j = 0; j < all.length; j++) {
                var isAll = all[j].getAttribute('data-cat') === '全部';
                all[j].classList.toggle('active', isAll);
                all[j].setAttribute('aria-selected', isAll ? 'true' : 'false');
              }
              applyFilter();
            });
          }
        }
      }
    }
    if (searchInput) {
      var composing = false;
      var searchTimer = null;
      searchInput.addEventListener('compositionstart', function() { composing = true; });
      searchInput.addEventListener('compositionend', function() {
        composing = false;
        applyFilter();
      });
      searchInput.addEventListener('input', function() {
        if (composing) return;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilter, 200);
      });
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          if (searchInput.value) {
            searchInput.value = '';
            applyFilter();
          } else {
            searchInput.blur();
          }
        }
      });
      document.addEventListener('keydown', function(e) {
        var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea') return;
        if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'k')) {
          e.preventDefault();
          searchInput.focus();
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        searchInput.value = '';
        applyFilter();
        if (searchInput.focus) searchInput.focus();
      });
    }
    applyFilter();
    (function initFromUrl() {
      try {
        var params = new URLSearchParams(window.location.search);
        var q = params.get('q');
        var cat = params.get('cat');
        var changed = false;
        if (q) { searchInput.value = q; changed = true; }
        if (cat && CATEGORIES.indexOf(cat) !== -1) {
          currentCategory = cat;
          var all = chipsBox ? chipsBox.querySelectorAll('.chip') : [];
          for (var i = 0; i < all.length; i++) {
            var isActive = all[i].getAttribute('data-cat') === cat;
            all[i].classList.toggle('active', isActive);
            all[i].setAttribute('aria-selected', isActive ? 'true' : 'false');
          }
          changed = true;
        }
        if (changed) applyFilter();
      } catch (e) {}
    })();

  })();
(function initScrollButtons() {
    var style = document.createElement('style');
    style.textContent =
        '.scroll-nav-btns {' +
            'position: fixed;' +
            'right: 24px;' +
            'bottom: 100px;' +
            'display: flex;' +
            'flex-direction: column;' +
            'gap: 12px;' +
            'z-index: 9998;' +
            'pointer-events: none;' +
        '}' +
        '.scroll-nav-btns button {' +
            'width: 48px;' +
            'height: 48px;' +
            'border-radius: 50%;' +
            'border: none;' +
            'background: #4a90d99e;' +
            'color: #fff;' +
            'font-size: 22px;' +
            'cursor: pointer;' +
            'box-shadow: 0 4px 12px rgba(74,144,217,0.4);' +
            'transition: opacity 0.3s, transform 0.3s, background 0.2s;' +
            'opacity: 0;' +
            'transform: scale(0.8);' +
            'pointer-events: none;' +
            'display: flex;' +
            'align-items: center;' +
            'justify-content: center;' +
            'line-height: 1;' +
            'padding: 0;' +
        '}' +
        '.scroll-nav-btns button:hover {' +
            'background: #357abdc7;' +
            'transform: scale(1.1);' +
        '}' +
        '.scroll-nav-btns button.visible {' +
            'opacity: 1;' +
            'transform: scale(1);' +
            'pointer-events: auto;' +
        '}' +
        '@media screen and (max-width: 640px) {' +
            '.scroll-nav-btns {' +
                'right: 12px;' +
                'bottom: 80px;' +
                'gap: 8px;' +
            '}' +
            '.scroll-nav-btns button {' +
                'width: 42px;' +
                'height: 42px;' +
                'font-size: 18px;' +
            '}' +
        '}';
    document.head.appendChild(style);
    var container = document.createElement('div');
    container.className = 'scroll-nav-btns';
    container.innerHTML =
        '<button type="button" id="btnScrollTop" title="回到顶部">↑</button>' +
        '<button type="button" id="btnScrollBottom" title="回到底部">↓</button>';
    document.body.appendChild(container);
    var btnTop = document.getElementById('btnScrollTop');
    var btnBottom = document.getElementById('btnScrollBottom');
    function smoothScrollTo(y) {
        window.scrollTo({ top: y, behavior: 'smooth' });
    }
    function updateButtons() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var scrollHeight = document.documentElement.scrollHeight;
        var clientHeight = window.innerHeight;
        var maxScroll = scrollHeight - clientHeight;
        if (scrollTop > 200) {
            btnTop.classList.add('visible');
        } else {
            btnTop.classList.remove('visible');
        }
        if (maxScroll - scrollTop > 200) {
            btnBottom.classList.add('visible');
        } else {
            btnBottom.classList.remove('visible');
        }
    }
    btnTop.addEventListener('click', function() {
        smoothScrollTo(0);
    });
    btnBottom.addEventListener('click', function() {
        smoothScrollTo(document.documentElement.scrollHeight);
    });
    var ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                updateButtons();
                ticking = false;
            });
            ticking = true;
        }
    });
    window.addEventListener('resize', updateButtons);
    updateButtons();
})();
//最近使用
(function () {
  'use strict';

  var REC_KEY     = 'wuli_recents_v1';
  var INDEX_KEY   = 'wuli_exp_index_v1';   // id → {name, url} 缓存
  var MAX_RECENTS = 4; //显示4条

  // ---------- 存储工具 ----------
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  var recents = readJSON(REC_KEY, [])
    .map ? readJSON(REC_KEY, []).map(Number).filter(function (n) { return n > 0; }) : [];

  // ---------- 从卡片抓取信息 ----------
  function extractCardInfo(card) {
    if (!card || !card.querySelector) return null;
    var link = card.querySelector('.exp-name a');
    if (!link) return null;
    var href = link.getAttribute('href') || '';
    var m = href.match(/(\d+)\.html/);
    if (!m) return null;
    return { id: parseInt(m[1], 10), name: link.textContent.trim(), url: href };
  }

  // ---------- id → {name,url} 映射（DOM + 缓存兜底） ----------
  function buildInfoMap() {
    var map = {};
    var cards = document.querySelectorAll('#expGrid .exp-card');
    for (var i = 0; i < cards.length; i++) {
      var info = extractCardInfo(cards[i]);
      if (info) map[info.id] = info;
    }
    var cached = readJSON(INDEX_KEY, {});
    for (var key in cached) {
      if (cached.hasOwnProperty(key) && !map[key]) map[key] = cached[key];
    }
    // 合并回缓存
    var merged = readJSON(INDEX_KEY, {}), changed = false;
    for (var id in map) {
      if (!merged[id] || merged[id].name !== map[id].name) {
        merged[id] = { id: map[id].id, name: map[id].name, url: map[id].url };
        changed = true;
      }
    }
    if (changed) writeJSON(INDEX_KEY, merged);
    return map;
  }

  // ---------- 转义 ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- 渲染「最近使用」栏 ----------
  function renderRecents() {
    var bar  = document.getElementById('recentBar');
    var list = document.getElementById('recentList');
    if (!bar || !list) return;

    var infoMap = buildInfoMap();
    var valid = recents.filter(function (id) { return !!infoMap[id]; });

    if (!valid.length) {
      bar.hidden = true;
      list.innerHTML = '';
      return;
    }
    var html = '';
    for (var i = 0; i < valid.length; i++) {
      var info = infoMap[valid[i]];
      html += '<a class="recent-item" href="' + esc(info.url) + '" data-id="' + info.id + '" role="listitem">' +
                esc(info.name) +
              '</a>';
    }
    list.innerHTML = html;
    bar.hidden = false;
  }

  // ---------- 记录最近使用 ----------
  function addRecent(id) {
    var i = recents.indexOf(id);
    if (i !== -1) recents.splice(i, 1);
    recents.unshift(id);
    if (recents.length > MAX_RECENTS) recents.length = MAX_RECENTS;
    writeJSON(REC_KEY, recents);
    renderRecents();
  }

  function clearRecents() {
    recents = [];
    writeJSON(REC_KEY, recents);
    renderRecents();
  }

  // ---------- 事件委托 ----------
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#recentClear')) {
      e.preventDefault();
      if (window.confirm('确定要清除最近使用记录吗？')) clearRecents();
      return;
    }
    var card = t.closest('#expGrid .exp-card');
    if (card) {
      var info = extractCardInfo(card);
      if (info) addRecent(info.id);
    }
  });

  // ---------- 初始化 ----------
  function init() { renderRecents(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();