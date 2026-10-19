/**
 * 🌸 MJC no Gakushuu Note — Anime Sakura Theme
 * 站点交互与特效总控。index.html 和 posts/*.html 都会加载本文件。
 *
 * 设计原则：
 *   · 零第三方依赖（不引 jQuery / anime.js / CDN），全部原生实现
 *   · 尊重 prefers-reduced-motion，尊重触屏设备
 *   · 标签页隐藏时暂停所有 rAF 循环，省电省 CPU
 *   · 所有特效都能在下面 FX 里单独开关，互不影响
 *   · 需要的 DOM（画布、按钮、进度条）由 JS 自建，
 *     所以以后新增文章页只要照常引 app.js 就自动生效，不用改 HTML
 */
(function () {
  "use strict";

  /* ==========================================================
   * 0. 特效开关 —— 不想要哪个，改成 false 即可
   * ========================================================== */
  var FX = {
    sakura:      true,   // 背景樱花飘落
    clickBurst:  true,   // 点击爱心 + 樱花瓣迸发
    fireworks:   true,   // 点击烟花粒子（樱花配色）
    cursor:      true,   // 自定义樱花鼠标指针
    typewriter:  true,   // hero 座右铭打字机
    funnyTitle:  true,   // 切走标签页时标题恶搞 + favicon 变🥀
    tilt:        true,   // 卡片 3D 倾斜跟随鼠标
    backToTop:   true,   // 回到顶部按钮（外圈=阅读进度环）
    readingBar:  true,   // 文章页顶部阅读进度条
    codeCopy:    true,   // 代码块一键复制
    themeToggle: true,   // 导航栏暗色模式切换按钮
    easterEgg:   true,   // 彩蛋：键盘敲 sakura 触发樱花暴雨
    waifu:       false   // 看板娘 live2d —— 需联网拉 CDN，默认关，说明见文件末尾
  };

  /* ---------- 公共环境判断 ---------- */
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqTouch  = window.matchMedia("(hover: none), (pointer: coarse)");
  var reduceMotion = mqReduce.matches;
  var isTouch = mqTouch.matches;
  var hidden = document.hidden;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  document.addEventListener("visibilitychange", function () {
    hidden = document.hidden;
  });

  var SAKURA_PALETTE = [
    "#FF9EC5", "#FFB3D1", "#E8709A", "#FFC8E1",
    "#C870E8", "#E8C170", "#A8D8EA", "#FFFFFF"
  ];

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /** 画一片五瓣樱花 */
  function drawSakura(ctx, x, y, r, angle, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      var px = Math.cos(a) * r * 0.62;
      var py = Math.sin(a) * r * 0.62;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      var notch = ((i + 0.5) * Math.PI * 2) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(notch) * r * 0.26, Math.sin(notch) * r * 0.26);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ==========================================================
   * 1. 主题（暗色模式）
   *    <head> 里有一段内联脚本在首屏前就设好 data-theme，
   *    这里负责运行时切换、持久化和跟随系统。
   * ========================================================== */
  var THEME_KEY = "mjc-theme";
  var mqDark = window.matchMedia("(prefers-color-scheme: dark)");

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function isDarkNow() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function applyTheme(mode) {
    var dark = mode === "dark" || (mode !== "light" && mqDark.matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#17111D" : "#FFF0F5");
    syncToggleButton();
  }
  function setTheme(mode) {
    try {
      if (mode === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, mode);
    } catch (e) { /* 隐私模式下 localStorage 会抛错，忽略即可 */ }
    applyTheme(mode);
  }

  // 系统主题变化时，若用户没手动指定过，则跟随
  function onSystemThemeChange() {
    var s = storedTheme();
    if (s !== "light" && s !== "dark") applyTheme("auto");
  }
  if (mqDark.addEventListener) mqDark.addEventListener("change", onSystemThemeChange);
  else if (mqDark.addListener) mqDark.addListener(onSystemThemeChange);

  /* ---------- 导航栏主题切换按钮（JS 注入，文章页也自动有） ---------- */
  var toggleBtn = null;
  function syncToggleButton() {
    if (!toggleBtn) return;
    var mode = storedTheme() || "auto";
    var icon = mode === "dark" ? "🌙" : mode === "light" ? "☀️" : "🌸";
    var label = mode === "dark" ? "暗色（点击切亮色）"
              : mode === "light" ? "亮色（点击切跟随系统）"
              : "跟随系统（点击切暗色）";
    toggleBtn.textContent = icon;
    toggleBtn.title = label;
    toggleBtn.setAttribute("aria-label", label);
  }
  function buildThemeToggle() {
    var nav = document.querySelector(".nav-links");
    if (!nav) return;
    toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "theme-toggle";
    toggleBtn.addEventListener("click", function () {
      var mode = storedTheme() || "auto";
      setTheme(mode === "light" ? "dark" : mode === "dark" ? "auto" : "light");
    });
    nav.appendChild(toggleBtn);
    syncToggleButton();
  }

  /* ==========================================================
   * 2. 背景樱花飘落（原有功能，做了性能与清晰度优化）
   * ========================================================== */
  var sakuraApi = (function () {
    var canvas = document.getElementById("sakura-canvas");
    if (!canvas || !FX.sakura || reduceMotion) return { storm: function () {} };
    var ctx = canvas.getContext("2d");
    var petals = [];
    var w = 0, h = 0;
    var boostUntil = 0;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed();
    }

    function Petal(init) { this.reset(init); }
    Petal.prototype.reset = function (init) {
      this.x = Math.random() * w;
      this.y = init ? Math.random() * h : -30;
      this.size = rand(8, 22);
      this.speed = rand(0.5, 2);
      this.wobble = rand(-1, 1);
      this.opacity = rand(0.2, 0.8);
      this.angle = Math.random() * Math.PI * 2;
      this.spin = rand(-0.015, 0.015);
      this.color = Math.random() > 0.25 ? "rgba(255,158,197,1)" : "rgba(255,200,225,1)";
    };
    Petal.prototype.update = function () {
      this.y += this.speed;
      this.x += Math.sin(this.angle) * 0.5 + this.wobble * 0.3;
      this.angle += this.spin;
      if (this.y > h + 40) this.reset(false);
    };

    function seed() {
      // 根据视口宽度决定花瓣数量，resize 时重新计算（原来只在加载时算一次）
      var target = Math.min(Math.floor(w / 22), 70);
      if (Date.now() < boostUntil) target = Math.min(target * 4, 260);
      while (petals.length < target) petals.push(new Petal(true));
      if (petals.length > target) petals.length = target;
    }

    var queued = false;
    var boosting = false;
    function frame() {
      queued = false;
      if (hidden) return;                       // 标签页切走就停，回来再续
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < petals.length; i++) {
        petals[i].update();
        drawSakura(ctx, petals[i].x, petals[i].y, petals[i].size / 2,
                   petals[i].angle, petals[i].color, petals[i].opacity);
      }
      // 暴雨开始/结束时重新计算花瓣数量，结束后自动缩回正常密度
      var nowBoost = Date.now() < boostUntil;
      if (nowBoost !== boosting) { boosting = nowBoost; seed(); }
      request();
    }
    function request() {
      if (!queued) { queued = true; requestAnimationFrame(frame); }
    }

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { DPR = Math.min(window.devicePixelRatio || 1, 2); resize(); request(); }, 200);
    });
    document.addEventListener("visibilitychange", function () { if (!hidden) request(); });

    resize();
    request();

    return {
      /** 彩蛋用：短时间制造樱花暴雨 */
      storm: function (ms) {
        boostUntil = Date.now() + (ms || 4000);
        seed();
        request();
      }
    };
  })();

  /* ==========================================================
   * 3. 点击特效层：爱心 + 樱花瓣 + 烟花粒子
   *    爱心用 DOM + CSS 动画（GPU 合成，比 rAF 逐帧改样式省），
   *    火花/花瓣用一个全屏 canvas 画。
   * ========================================================== */
  var fxCtx = null;
  (function () {
    if ((!FX.clickBurst && !FX.fireworks) || reduceMotion) return;

    var canvas = document.createElement("canvas");
    canvas.id = "fx-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    fxCtx = canvas.getContext("2d");

    var w = 0, h = 0;
    var parts = [];
    var running = false;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      fxCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function Spark(x, y, color, power) {
      var a = Math.random() * Math.PI * 2;
      var v = rand(1, 5) * power;
      this.x = x; this.y = y;
      this.vx = Math.cos(a) * v;
      this.vy = Math.sin(a) * v - rand(0, 1.5);
      this.life = 1;
      this.decay = rand(0.012, 0.026);
      this.r = rand(1.4, 3.4);
      this.color = color;
      this.kind = "spark";
    }
    function FlyPetal(x, y, color, power) {
      var a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      var v = rand(2, 6) * power;
      this.x = x; this.y = y;
      this.vx = Math.cos(a) * v;
      this.vy = Math.sin(a) * v;
      this.life = 1;
      this.decay = rand(0.008, 0.016);
      this.r = rand(4, 8);
      this.angle = Math.random() * Math.PI * 2;
      this.spin = rand(-0.14, 0.14);
      this.color = color;
      this.kind = "petal";
    }

    function step() {
      if (hidden || parts.length === 0) { running = false; return; }
      fxCtx.clearRect(0, 0, w, h);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.vy += 0.075;          // 重力
        p.vx *= 0.985;          // 空气阻力
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        if (p.kind === "spark") {
          fxCtx.save();
          fxCtx.globalAlpha = Math.max(0, p.life);
          fxCtx.shadowBlur = 8;
          fxCtx.shadowColor = p.color;
          fxCtx.fillStyle = p.color;
          fxCtx.beginPath();
          fxCtx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          fxCtx.fill();
          fxCtx.restore();
        } else {
          p.angle += p.spin;
          drawSakura(fxCtx, p.x, p.y, p.r, p.angle, p.color, Math.max(0, p.life));
        }
      }
      requestAnimationFrame(step);
    }
    function kick() {
      if (!running) { running = true; requestAnimationFrame(step); }
    }

    /** 在 (x,y) 炸开一朵樱花烟花 */
    function burst(x, y, power) {
      var n = Math.round((isTouch ? 12 : 20) * power);
      for (var i = 0; i < n; i++) parts.push(new Spark(x, y, pick(SAKURA_PALETTE), power));
      var m = Math.round((isTouch ? 3 : 6) * power);
      for (var j = 0; j < m; j++) parts.push(new FlyPetal(x, y, pick(SAKURA_PALETTE), power));
      if (parts.length > 600) parts.splice(0, parts.length - 600);
      kick();
    }

    /* ---------- DOM 爱心 / emoji ---------- */
    var liveNodes = 0;
    var MAX_NODES = 140;
    var HEART_COLORS = ["#FF9EC5", "#FFB3D1", "#E8709A", "#FFC8E1", "#C870E8"];
    var BURST_EMOJI = ["🌸", "✨", "🩷", "💮", "🌸"];

    function spawnNode(cls, x, y, setup) {
      if (liveNodes > MAX_NODES) return;
      var el = document.createElement("span");
      el.className = cls;
      el.style.left = x + "px";
      el.style.top = y + "px";
      setup(el);
      liveNodes++;
      document.body.appendChild(el);
      el.addEventListener("animationend", function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        liveNodes--;
      });
    }

    function clickFx(e) {
      var x = e.clientX, y = e.clientY;
      if (x == null || y == null) return;

      if (FX.clickBurst) {
        // 主爱心：直直往上飘
        spawnNode("fx-heart", x, y, function (el) {
          el.style.setProperty("--c", pick(HEART_COLORS));
          el.style.setProperty("--dx", rand(-14, 14) + "px");
          el.style.setProperty("--dy", rand(-70, -45) + "px");
        });
        // 四散的小爱心
        var n = isTouch ? 3 : 5;
        for (var i = 0; i < n; i++) {
          (function () {
            var ox = x + rand(-10, 10), oy = y + rand(-10, 10);
            spawnNode("fx-heart", ox, oy, function (el) {
              el.style.setProperty("--c", pick(HEART_COLORS));
              el.style.setProperty("--dx", rand(-55, 55) + "px");
              el.style.setProperty("--dy", rand(-95, -35) + "px");
              el.style.width = el.style.height = "7px";
              el.style.animationDuration = rand(700, 1050) + "ms";
            });
          })();
        }
        // 偶尔蹦出 emoji
        if (Math.random() < 0.55) {
          spawnNode("fx-emoji", x, y, function (el) {
            el.textContent = pick(BURST_EMOJI);
            el.style.setProperty("--dx", rand(-45, 45) + "px");
            el.style.setProperty("--dy", rand(-110, -60) + "px");
            el.style.setProperty("--rot", rand(-140, 140) + "deg");
            el.style.fontSize = rand(13, 21) + "px";
          });
        }
      }

      if (FX.fireworks && fxCtx) burst(x, y, 1);
    }

    document.addEventListener("pointerdown", clickFx, { passive: true });

    // 切走标签页时粒子循环会停；回来若还有残留粒子就续上
    document.addEventListener("visibilitychange", function () {
      if (!hidden && parts.length) kick();
    });

    // 暴露给彩蛋用
    window.__sakuraBurst = function (x, y, power) {
      if (fxCtx) burst(x, y, power || 2.2);
    };
  })();

  /* ==========================================================
   * 4. 自定义樱花鼠标指针
   *    SVG 现场生成 + encodeURIComponent，不用下载 .cur 文件，
   *    也避免了原文里那种外链 CDN 挂了就变默认箭头的问题。
   * ========================================================== */
  (function () {
    if (!FX.cursor || isTouch) return;

    function svg(petalFill, stroke, core, scale) {
      var s = "";
      for (var i = 0; i < 5; i++) {
        s += "<ellipse cx='16' cy='" + (16 - 7.5 * scale) + "' rx='" + (4.3 * scale) +
             "' ry='" + (6.2 * scale) + "' transform='rotate(" + (i * 72) + " 16 16)'/>";
      }
      return "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>" +
             "<g fill='" + petalFill + "' stroke='" + stroke + "' stroke-width='1.1'>" + s + "</g>" +
             "<circle cx='16' cy='16' r='" + (2.8 * scale) + "' fill='" + core + "'/></svg>";
    }
    function cur(markup) {
      return "url(\"data:image/svg+xml," + encodeURIComponent(markup) + "\") 16 16";
    }

    var normal = cur(svg("#FFB3D1", "#E8709A", "#E8C170", 1));
    var pointer = cur(svg("#FF9EC5", "#C94F7C", "#FFFFFF", 1.12));

    var st = document.createElement("style");
    st.textContent =
      "body, body *:not(a):not(button):not(summary):not([role='button']):not(.code-copy):not(.theme-toggle):not(.to-top)" +
      "{cursor:" + normal + ",auto}" +
      "a, button, summary, [role='button'], .code-copy, .theme-toggle, .to-top, .blog-card" +
      "{cursor:" + pointer + ",pointer}";
    document.head.appendChild(st);
  })();

  /* ==========================================================
   * 5. Hero 打字机（彩色滚动变换字体）
   *    原文的 binft 是压缩过的一坨，这里重写成语雀能读懂的版本，
   *    配色改成樱花→紫→天蓝渐变，和站点主题一致。
   * ========================================================== */
  (function () {
    var host = document.getElementById("binft");
    if (!host || !FX.typewriter) return;

    var phrases = (host.getAttribute("data-phrases") || "").split("|");
    if (phrases.length < 2) {
      phrases = [
        "源码级理解 + AI Agent 差异化",
        "深度优先 · 不追广度追深度",
        "Java 后端 · 江南大学 211",
        "每 50 分钟起身，这不是可选项",
        "青青陵上柏，磊磊涧中石",
        "人生天地间，忽如远行客"
      ];
    }

    if (reduceMotion) { host.textContent = phrases[0]; return; }

    var TAIL_COLORS = [
      "rgb(255,158,197)", "rgb(232,112,154)", "rgb(200,112,232)",
      "rgb(155,109,255)", "rgb(168,216,234)", "rgb(232,193,112)",
      "rgb(255,200,225)", "rgb(109,213,216)"
    ];
    var TAIL = 5;
    var TYPE_MS = 78, DEL_MS = 34, HOLD_MS = 1900, GAP_MS = 340;
    var idx = 0, pos = 0, deleting = false, timer = null;

    function tail(n) {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < n; i++) {
        var s = document.createElement("span");
        s.className = "binft-tail";
        s.textContent = String.fromCharCode(33 + Math.floor(Math.random() * 94));
        s.style.color = pick(TAIL_COLORS);
        frag.appendChild(s);
      }
      return frag;
    }

    function frame() {
      var full = phrases[idx];
      host.textContent = full.slice(0, pos);
      var n = deleting ? Math.min(TAIL, pos) : Math.min(TAIL, full.length - pos + 2);
      if (n > 0) host.appendChild(tail(n));

      var delay;
      if (!deleting) {
        if (pos < full.length) { pos++; delay = TYPE_MS + Math.random() * 55; }
        else { deleting = true; delay = HOLD_MS; }
      } else {
        if (pos > 0) { pos--; delay = DEL_MS; }
        else { deleting = false; idx = (idx + 1) % phrases.length; delay = GAP_MS; }
      }
      timer = setTimeout(frame, delay);
    }

    // 标签页切走时停表，回来再续，避免后台空转
    document.addEventListener("visibilitychange", function () {
      if (hidden) { clearTimeout(timer); timer = null; }
      else if (!timer) frame();
    });

    frame();
  })();

  /* ==========================================================
   * 6. 浏览器标题恶搞 + favicon 切换
   * ========================================================== */
  var FAVICON_SAKURA = "data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌸</text></svg>");
  var FAVICON_WILT = "data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥀</text></svg>");

  (function () {
    if (!FX.funnyTitle) return;
    var link = document.querySelector('link[rel~="icon"]');
    var originTitle = document.title;
    var restoreTimer = null;

    function setFavicon(href) { if (link) link.setAttribute("href", href); }

    document.addEventListener("visibilitychange", function () {
      if (hidden) {
        clearTimeout(restoreTimer);
        setFavicon(FAVICON_WILT);
        document.title = "🥀 樱花都谢了…你去哪了";
      } else {
        setFavicon(FAVICON_SAKURA);
        document.title = "🌸 欢迎回来！ " + originTitle;
        clearTimeout(restoreTimer);
        restoreTimer = setTimeout(function () { document.title = originTitle; }, 2500);
      }
    });
  })();

  /* ==========================================================
   * 7. 回到顶部 + 阅读进度环 + 文章页顶部进度条
   * ========================================================== */
  (function () {
    if (!FX.backToTop && !FX.readingBar) return;

    var btn = null, ring = null, bar = null;
    var R = 23, CIRC = 2 * Math.PI * R;
    var isPost = !!document.querySelector(".post-content");

    if (FX.backToTop) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "to-top";
      btn.id = "toTop";
      btn.title = "回到顶部";
      btn.setAttribute("aria-label", "回到顶部");
      btn.innerHTML =
        '<svg viewBox="0 0 52 52" aria-hidden="true">' +
          '<defs><linearGradient id="toTopGrad" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" style="stop-color:var(--sakura)"/>' +
            '<stop offset="100%" style="stop-color:var(--violet)"/>' +
          '</linearGradient></defs>' +
          '<circle class="ring-bg" cx="26" cy="26" r="' + R + '"/>' +
          '<circle class="ring-fg" cx="26" cy="26" r="' + R + '"/>' +
        '</svg>' +
        '<span class="to-top-icon" aria-hidden="true">🌸</span>';
      document.body.appendChild(btn);
      ring = btn.querySelector(".ring-fg");
      ring.style.strokeDasharray = CIRC;
      ring.style.strokeDashoffset = CIRC;
      btn.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      });
    }

    if (FX.readingBar && isPost) {
      bar = document.createElement("div");
      bar.id = "read-bar";
      bar.setAttribute("aria-hidden", "true");
      bar.innerHTML = "<i></i>";
      document.body.appendChild(bar);
      bar = bar.firstChild;
    }

    var ticking = false;
    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (ring) ring.style.strokeDashoffset = CIRC * (1 - p);
      if (bar) bar.style.width = (p * 100).toFixed(2) + "%";
      if (btn) {
        if (window.scrollY > 500) btn.classList.add("show");
        else btn.classList.remove("show");
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  })();

  /* ==========================================================
   * 8. 代码块一键复制（文章页）
   * ========================================================== */
  (function () {
    if (!FX.codeCopy) return;
    var blocks = document.querySelectorAll(".post-content pre");
    if (!blocks.length) return;

    Array.prototype.forEach.call(blocks, function (pre) {
      if (pre.parentNode.classList.contains("code-wrap")) return;
      var wrap = document.createElement("div");
      wrap.className = "code-wrap";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-copy";
      btn.textContent = "复制";
      btn.addEventListener("click", function () {
        var text = pre.innerText;
        function done(ok) {
          btn.textContent = ok ? "已复制 🌸" : "复制失败";
          btn.classList.add("done");
          setTimeout(function () {
            btn.textContent = "复制";
            btn.classList.remove("done");
          }, 1800);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); },
                                                  function () { done(false); });
        } else {
          // http 环境或老浏览器的兜底方案
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
          document.body.removeChild(ta);
          done(ok);
        }
      });
      wrap.appendChild(btn);
    });
  })();

  /* ==========================================================
   * 9. 卡片 3D 倾斜跟随鼠标
   * ========================================================== */
  (function () {
    if (!FX.tilt || isTouch || reduceMotion) return;
    var cards = document.querySelectorAll(".skill-card, .data-card, .flow-item, .blog-card, .hero-stat");
    if (!cards.length) return;
    var MAX = 7;

    Array.prototype.forEach.call(cards, function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.classList.add("tilt-on");
        el.style.transform =
          "perspective(760px) translateY(-4px) scale(1.02) " +
          "rotateX(" + (-py * MAX).toFixed(2) + "deg) " +
          "rotateY(" + (px * MAX).toFixed(2) + "deg)";
      });
      el.addEventListener("mouseleave", function () {
        el.classList.remove("tilt-on");
        el.style.transform = "";
      });
    });
  })();

  /* ==========================================================
   * 10. 滚动进入视口时淡入（原有功能）
   * ========================================================== */
  (function () {
    var targets = document.querySelectorAll(".animate-in");
    if (!targets.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add("visible"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });

    // 首屏元素立刻显示，不要等滚动
    setTimeout(function () {
      Array.prototype.forEach.call(targets, function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("visible");
      });
    }, 120);
  })();

  /* ==========================================================
   * 11. 锚点平滑滚动（原有功能）
   *     CSS 里已加 scroll-padding-top，这里负责兼容旧行为
   * ========================================================== */
  (function () {
    var links = document.querySelectorAll('a[href^="#"]');
    Array.prototype.forEach.call(links, function (a) {
      a.addEventListener("click", function (e) {
        var href = a.getAttribute("href");
        if (!href || href === "#") return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        // 用 file:// 直接打开页面时 replaceState 会抛 SecurityError，包一层
        try { if (history.replaceState) history.replaceState(null, "", href); } catch (err) { /* 忽略 */ }
      });
    });
  })();

  /* ==========================================================
   * 12. 导航高亮（原有功能，改成 rAF 节流 + 只在变化时写样式）
   * ========================================================== */
  (function () {
    var sections = document.querySelectorAll("section[id]");
    var navLinks = document.querySelectorAll(".nav-links a");
    if (!sections.length || !navLinks.length) return;

    var current = null, ticking = false;

    function paint(id) {
      if (id === current) return;
      current = id;
      Array.prototype.forEach.call(navLinks, function (link) {
        var on = link.getAttribute("href") === "#" + id;
        link.style.color = on ? "var(--sakura-dark)" : "";
        link.style.borderColor = on ? "var(--sakura)" : "transparent";
        link.style.background = on ? "rgba(255,158,197,0.08)" : "none";
      });
    }

    function update() {
      ticking = false;
      var y = window.scrollY + 110;
      var found = null;
      Array.prototype.forEach.call(sections, function (sec) {
        if (sec.offsetTop <= y && sec.offsetTop + sec.offsetHeight > y) found = sec.id;
      });
      paint(found);
    }

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ==========================================================
   * 13. 技能进度条入场动画（原有功能）
   * ========================================================== */
  (function () {
    var cards = document.querySelectorAll(".card");
    if (!("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var fills = entry.target.querySelectorAll(".progress-fill");
        Array.prototype.forEach.call(fills, function (fill) {
          var target = fill.style.width;
          fill.style.width = "0%";
          setTimeout(function () { fill.style.width = target; }, 180);
        });
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2 });

    Array.prototype.forEach.call(cards, function (card) {
      if (card.querySelector(".progress-fill")) io.observe(card);
    });
  })();

  /* ==========================================================
   * 14. 彩蛋：键盘敲下 sakura → 樱花暴雨 + 全屏烟花
   * ========================================================== */
  (function () {
    if (!FX.easterEgg || reduceMotion) return;
    var buf = "";
    document.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
      if (!e.key || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-6);
      if (buf !== "sakura") return;
      buf = "";

      sakuraApi.storm(5000);

      if (window.__sakuraBurst) {
        var w = window.innerWidth, h = window.innerHeight;
        var shots = 0;
        var iv = setInterval(function () {
          window.__sakuraBurst(rand(w * 0.1, w * 0.9), rand(h * 0.15, h * 0.7), rand(1.6, 2.8));
          if (++shots > 14) clearInterval(iv);
        }, 260);
      }

      var tip = document.createElement("div");
      tip.textContent = "🌸 樱花暴雨！";
      // 用 CSS 的 translate 属性做居中，这样动画里的 transform 不会把它顶跑
      tip.setAttribute("style",
        "position:fixed;left:50%;top:38%;translate:-50% -50%;z-index:10000;" +
        "font-size:2em;font-weight:800;color:var(--sakura-dark);pointer-events:none;" +
        "text-shadow:0 2px 16px rgba(255,158,197,.6);white-space:nowrap;" +
        "animation:fxEmojiFly 1.6s ease-out forwards");
      tip.style.setProperty("--dx", "0px");
      tip.style.setProperty("--dy", "-60px");
      tip.style.setProperty("--rot", "0deg");
      document.body.appendChild(tip);
      setTimeout(function () { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 1700);
    });
  })();

  /* ==========================================================
   * 15. 看板娘（live2d）—— 默认关闭
   *
   * 原文那套是 Hexo 插件（hexo-helper-live2d），本站不是 Hexo，装不了。
   * 想用得走 CDN 版 live2d-widget，代价是：
   *   · 引入外部依赖，违背本站「零依赖」原则
   *   · jsdelivr 在国内时通时不通，挂了就是控制台报错
   *   · 模型 JSON + 贴图约 500KB~2MB，首屏变慢
   *   · 它自带的对话框/工具按钮样式会和樱花主题打架
   * 想开就把上面 FX.waifu 改成 true，下面的 CDN 地址可自行替换。
   * ========================================================== */
  (function () {
    if (!FX.waifu) return;
    window.L2Dwidget = undefined;
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/live2d-widget@3.1.4/lib/L2Dwidget.min.js";
    s.async = true;
    s.onload = function () {
      if (!window.L2Dwidget) return;
      window.L2Dwidget.init({
        pluginRootPath: "lib/",
        pluginJsPath: "lib/",
        pluginModelPath: "assets/",
        tagMode: false,
        debug: false,
        model: { jsonPath: "https://cdn.jsdelivr.net/npm/live2d-widget-model-haruto@1.0.5/assets/haruto.model.json" },
        display: { position: "right", width: 150, height: 300, hOffset: 0, vOffset: -20 },
        mobile: { show: false },
        log: false,
        dialog: { enable: false }
      });
    };
    s.onerror = function () {
      console.warn("🌸 看板娘加载失败（CDN 不可达），已跳过，不影响其他功能。");
    };
    document.head.appendChild(s);
  })();

  /* ---------- 启动 ---------- */
  if (FX.themeToggle) buildThemeToggle();
  applyTheme(storedTheme() || "auto");

  console.log(
    "%c🌸 MJC no Gakushuu Note — Ready! 🌸\n%c敲下 sakura 有惊喜",
    "color:#E8709A;font-size:14px;font-weight:bold",
    "color:#C870E8;font-size:11px"
  );
})();
