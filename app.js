/**
 * MJC no Gakushuu Note - Anime Sakura Theme
 * Sakura petal animation, scroll-triggered reveals, smooth navigation
 */

// ===== Sakura Falling Animation =====
(function() {
  "use strict";
  var canvas = document.getElementById("sakura-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var petals = [];
  var w, h;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function Petal() {
    this.reset(true);
  }

  Petal.prototype.reset = function(init) {
    this.x = Math.random() * w;
    this.y = init ? Math.random() * h : -30;
    this.size = Math.random() * 14 + 8;
    this.speed = Math.random() * 1.5 + 0.5;
    this.wobble = Math.random() * 2 - 1;
    this.opacity = Math.random() * 0.6 + 0.2;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.03;
    this.hue = Math.random() > 0.25 ? "rgba(255,158,197," : "rgba(255,200,225,";
  };

  Petal.prototype.update = function() {
    this.y += this.speed;
    this.x += Math.sin(this.angle) * 0.5 + this.wobble * 0.3;
    this.angle += this.spin;
    if (this.y > h + 40) { this.reset(false); }
  };

  Petal.prototype.draw = function() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = this.hue + this.opacity + ")";
    ctx.beginPath();
    var r = this.size / 2;
    // Draw a 5-petal sakura shape
    for (var i = 0; i < 5; i++) {
      var a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      var cx = Math.cos(a) * r * 0.6;
      var cy = Math.sin(a) * r * 0.6;
      if (i === 0) { ctx.moveTo(cx, cy); }
      else { ctx.lineTo(cx, cy); }
      // Notch between petals
      var notch = (i + 0.5) * Math.PI * 2 / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(notch) * r * 0.25, Math.sin(notch) * r * 0.25);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Create petals
  var petalCount = Math.min(Math.floor(window.innerWidth / 25), 60);
  for (var i = 0; i < petalCount; i++) {
    petals.push(new Petal());
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < petals.length; i++) {
      petals[i].update();
      petals[i].draw();
    }
    requestAnimationFrame(animate);
  }
  animate();
})();

// ===== Scroll-triggered Reveal Animation =====
(function() {
  "use strict";
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll(".animate-in").forEach(function(el) {
    observer.observe(el);
    // Stagger initial visible elements
    setTimeout(function() {
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.classList.add("visible");
      }
    }, 150);
  });
})();

// ===== Smooth Scroll Navigation =====
(function() {
  "use strict";
  document.querySelectorAll('a[href^="#"]').forEach(function(a) {
    a.addEventListener("click", function(e) {
      e.preventDefault();
      var target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
})();

// ===== Active Nav Highlight on Scroll =====
(function() {
  "use strict";
  var sections = document.querySelectorAll("section[id]");
  var navLinks = document.querySelectorAll(".nav-links a");

  function updateActive() {
    var scrollY = window.scrollY + 100;
    sections.forEach(function(sec) {
      if (sec.offsetTop <= scrollY && sec.offsetTop + sec.offsetHeight > scrollY) {
        navLinks.forEach(function(link) {
          link.style.color = "";
          link.style.borderColor = "transparent";
          link.style.background = "none";
        });
        var active = document.querySelector('.nav-links a[href="#' + sec.id + '"]');
        if (active) {
          active.style.color = "var(--sakura-dark)";
          active.style.borderColor = "var(--sakura)";
          active.style.background = "rgba(255,158,197,0.08)";
        }
      }
    });
  }

  window.addEventListener("scroll", updateActive);
  updateActive();
})();

// ===== Progress Bar Animation =====
(function() {
  "use strict";
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var fills = entry.target.querySelectorAll(".progress-fill");
        fills.forEach(function(fill) {
          var targetWidth = fill.style.width;
          fill.style.width = "0%";
          setTimeout(function() {
            fill.style.width = targetWidth;
          }, 200);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll(".card").forEach(function(card) {
    if (card.querySelector(".progress-fill")) {
      observer.observe(card);
    }
  });
})();

console.log("\uD83C\uDF38 MJC no Gakushuu Note - Ready! \uD83C\uDF38");
