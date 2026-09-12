/* ==========================================
   EXPLORE DIMA HASAO — MAIN.JS
   Shared behavior across every page
========================================== */
(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector(".menu-btn");
  const mobileMenu = document.querySelector(".mobile-menu");
  const scrim = document.querySelector(".scrim");

  function closeMenu() {
    menuBtn?.classList.remove("open");
    mobileMenu?.classList.remove("show-menu");
    scrim?.classList.remove("show");
    document.body.classList.remove("menu-open");
    menuBtn?.setAttribute("aria-expanded", "false");
  }
  function openMenu() {
    menuBtn?.classList.add("open");
    mobileMenu?.classList.add("show-menu");
    scrim?.classList.add("show");
    document.body.classList.add("menu-open");
    menuBtn?.setAttribute("aria-expanded", "true");
  }
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => {
      mobileMenu.classList.contains("show-menu") ? closeMenu() : openMenu();
    });
  }
  scrim?.addEventListener("click", closeMenu);
  document.querySelectorAll(".mobile-menu a").forEach(link => link.addEventListener("click", closeMenu));
  window.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

  /* ---------- Sticky header ---------- */
  const header = document.querySelector("header");
  let lastY = window.scrollY;
  function onHeaderScroll() {
    if (!header) return;
    header.classList.toggle("sticky", window.scrollY > 60);
    lastY = window.scrollY;
  }
  window.addEventListener("scroll", onHeaderScroll, { passive: true });
  onHeaderScroll();

  /* ---------- Active nav link ---------- */
  const currentPage = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a, .mobile-menu a").forEach(link => {
    const href = link.getAttribute("href");
    if (href === currentPage) link.classList.add("active");
  });

  /* ---------- Scroll progress bar ---------- */
  const progress = document.createElement("div");
  progress.id = "scroll-progress";
  document.body.appendChild(progress);
  function onProgress() {
    const h = document.documentElement;
    const scrollable = h.scrollHeight - h.clientHeight;
    progress.style.width = scrollable > 0 ? `${(h.scrollTop / scrollable) * 100}%` : "0%";
  }
  window.addEventListener("scroll", onProgress, { passive: true });
  onProgress();

  /* ---------- Back to top ---------- */
  const toTop = document.createElement("button");
  toTop.className = "to-top";
  toTop.setAttribute("aria-label", "Back to top");
  toTop.innerHTML = "&uarr;";
  document.body.appendChild(toTop);
  window.addEventListener("scroll", () => {
    toTop.classList.toggle("show", window.scrollY > 600);
  }, { passive: true });
  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });

  /* ---------- Auto-tag reveal targets ---------- */
  const autoRevealSelector = [
    ".dest-card-wrap", ".pkg-card-wrap", ".value-card", ".testi-card",
    ".g-item", ".stat", ".section-head", ".faq-item", ".about-media",
    ".about-copy", ".contact-info", ".contact-form-box", ".summary-card",
    ".booking-form"
  ].join(",");

  document.querySelectorAll(autoRevealSelector).forEach((el, i) => {
    if (!el.classList.contains("reveal") && !el.classList.contains("reveal-scale") &&
        !el.classList.contains("reveal-left") && !el.classList.contains("reveal-right")) {
      el.classList.add("reveal");
    }
    el.style.setProperty("--reveal-delay", `${Math.min(i % 3, 2) * 90}ms`);
  });

  /* ---------- Scroll reveal (IntersectionObserver) ---------- */
  const revealTargets = document.querySelectorAll(".reveal, .reveal-scale, .reveal-left, .reveal-right, .contour");
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add("is-visible"));
  }

  /* ---------- Counters ---------- */
  const counters = document.querySelectorAll(".stat .num[data-count]");
  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    if (isNaN(target)) return;
    if (prefersReducedMotion) { el.textContent = target + suffix; return; }
    el.classList.add("counting");
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-IN") + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if (counters.length) {
    const counterIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(c => counterIO.observe(c));
  }

  /* ---------- 3D tilt on cards (fine pointer only) ---------- */
  if (isFinePointer && !prefersReducedMotion) {
    document.querySelectorAll(".tilt").forEach(card => {
      const inner = card.querySelector(".tilt-inner") || card;
      let raf = null;
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        const rx = (0.5 - py) * 10;
        const ry = (px - 0.5) * 12;
        card.classList.add("is-tilting");
        card.style.setProperty("--gx", `${px * 100}%`);
        card.style.setProperty("--gy", `${py * 100}%`);
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          inner.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px)`;
        });
      });
      card.addEventListener("pointerleave", () => {
        card.classList.remove("is-tilting");
        inner.style.transform = "perspective(1200px) rotateX(0) rotateY(0) translateZ(0)";
      });
    });
  }

  /* ---------- Smooth scroll for in-page anchors ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href.length < 2) return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
        closeMenu();
      }
    });
  });

  /* ---------- Toast helper (used by page scripts) ---------- */
  window.showToast = function (message) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 3600);
  };
})();
