/* ==========================================
   GALLERY.JS — lightbox with keyboard + swipe nav
========================================== */
(() => {
  "use strict";
  const items = Array.from(document.querySelectorAll(".g-item"));
  const lightbox = document.getElementById("lightbox");
  if (!items.length || !lightbox) return;

  const lbImg = lightbox.querySelector("img");
  const lbTitle = lightbox.querySelector("h3");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const prevBtn = lightbox.querySelector(".lightbox-nav.prev");
  const nextBtn = lightbox.querySelector(".lightbox-nav.next");
  let current = 0;

  function open(index) {
    current = index;
    render();
    lightbox.classList.add("show");
    document.body.classList.add("menu-open");
  }
  function close() {
    lightbox.classList.remove("show");
    document.body.classList.remove("menu-open");
  }
  function render() {
    const item = items[current];
    const img = item.querySelector("img");
    lbImg.src = img.src;
    lbImg.alt = img.alt || "";
    lbTitle.textContent = item.dataset.title || img.alt || "";
  }
  function step(dir) {
    current = (current + dir + items.length) % items.length;
    render();
  }

  items.forEach((item, i) => {
    item.addEventListener("click", () => open(i));
    item.setAttribute("tabindex", "0");
    item.setAttribute("role", "button");
    item.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
    });
  });

  closeBtn?.addEventListener("click", close);
  prevBtn?.addEventListener("click", () => step(-1));
  nextBtn?.addEventListener("click", () => step(1));
  lightbox.addEventListener("click", e => { if (e.target === lightbox) close(); });

  window.addEventListener("keydown", e => {
    if (!lightbox.classList.contains("show")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  /* touch swipe */
  let touchX = null;
  lightbox.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) step(dx > 0 ? -1 : 1);
    touchX = null;
  }, { passive: true });
})();
