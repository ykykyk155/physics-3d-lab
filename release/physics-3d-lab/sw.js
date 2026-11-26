/* Service Worker：整站本地缓存 —— 打开过一次后，全部资源走本地缓存，秒开、断网也能用。
 * 版本号 17f2e48 由 tools/make-release.ps1 在发布时替换为 git 短哈希：
 * 每次发布自动换缓存名；新 SW 安装完成后清掉旧缓存，保证新旧版本绝不混用。
 * 策略（为发布一致性 + 跨境提速而设计）：
 *   - 安装：容错 precache 核心清单（某项失败不影响整体安装），skipWaiting 立即接管
 *   - HTML 导航：cache-first —— 每次打开只读缓存、立刻出页面；新版本靠新 SW 的
 *     precache 带进来，在同一缓存名内 HTML 与 JS 永远同版本，不会出现
 *     「新 HTML + 旧 JS」的混合状态（发布后第一次打开仍是旧版，刷新一次即新版）
 *   - 其他同源 GET：cache-first，miss 才走网络并写入缓存
 */
const VERSION = '17f2e48';
const CACHE = 'phlab-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './experiments.js',
  './data/experiments.json',
  './vendor/three.module.js',
  './vendor/three.core.js',
  './vendor/addons/controls/OrbitControls.js',
  './vendor/addons/renderers/CSS2DRenderer.js',
  './vendor/addons/lines/Line2.js',
  './vendor/addons/lines/LineGeometry.js',
  './vendor/addons/lines/LineMaterial.js',
  './vendor/addons/lines/LineSegments2.js',
  './vendor/addons/lines/LineSegmentsGeometry.js',
  './vendor/addons/utils/BufferGeometryUtils.js',
  './exp/common.js',
  './exp/props.js',
  './exp/mechanics.js',
  './exp/optics.js',
  './exp/acoustics.js',
  './exp/electricity.js',
  './exp/thermal.js',
  // 注意：vendor/ammo/ammo.js 故意不在预缓存清单——首屏必须 0 次引擎请求（A2 专用引擎，gzip 314KB）。
  // 首次在线进入 A2 时由下面 fetch 的 cache-first 逻辑自然写入缓存，之后 A2 即可离线使用。
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 容错：个别文件失败（网络抖动）不拖垮整体安装；miss 的项之后按需网络补
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => {
        // 有旧版本缓存 = 这是一次版本升级（不是首次安装）
        const isUpdate = keys.some((k) => k.startsWith('phlab-') && k !== CACHE);
        return Promise.all(keys.filter((k) => k.startsWith('phlab-') && k !== CACHE).map((k) => caches.delete(k)))
          .then(() => self.clients.claim())
          .then(() => {
            if (!isUpdate) return;
            // 版本升级：把打开中的页面强制刷新一次，让用户立刻看到新版本。
            // 不依赖页面里的 JS（旧版本页面没有自动更新代码也能切新）。
            return self.clients.matchAll({ type: 'window' }).then((cs) =>
              Promise.allSettled(cs.map((c) => c.navigate(c.url).catch(() => {})))
            );
          });
      })
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;

  // 页面导航：缓存优先（同版本 HTML/JS 永不混合），缓存未命中才走网络并写入
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req)
        .then((m) => m || caches.match('./index.html'))
        .then((m) => m || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }))
    );
    return;
  }

  // 静态资源：缓存优先，miss 走网络并写入
  e.respondWith(
    caches.match(req).then(
      (m) =>
        m ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});