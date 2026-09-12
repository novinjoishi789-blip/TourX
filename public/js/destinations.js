/* ==========================================
   DESTINATIONS.JS — live search + season filter
========================================== */
(() => {
  "use strict";
  const searchInput = document.getElementById("destSearch");
  const seasonSelect = document.getElementById("destSeason");
  const typeSelect = document.getElementById("destType");
  const resetBtn = document.getElementById("destReset");
  const cards = Array.from(document.querySelectorAll(".dest-card-wrap"));
  const emptyState = document.getElementById("destEmpty");
  const resultCount = document.getElementById("destCount");

  if (!cards.length) return;

  function applyFilters() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    const season = seasonSelect?.value || "all";
    const type = typeSelect?.value || "all";
    let visible = 0;

    cards.forEach(card => {
      const name = (card.dataset.name || "").toLowerCase();
      const cardSeason = card.dataset.season || "";
      const cardType = card.dataset.type || "";
      const matchesQ = !q || name.includes(q);
      const matchesSeason = season === "all" || cardSeason === season;
      const matchesType = type === "all" || cardType === type;
      const show = matchesQ && matchesSeason && matchesType;
      card.classList.toggle("filtered-out", !show);
      if (show) visible++;
    });

    if (emptyState) emptyState.style.display = visible === 0 ? "block" : "none";
    if (resultCount) resultCount.textContent = `${visible} of ${cards.length} destinations`;
  }

  let debounce;
  searchInput?.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(applyFilters, 150);
  });
  seasonSelect?.addEventListener("change", applyFilters);
  typeSelect?.addEventListener("change", applyFilters);
  resetBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (seasonSelect) seasonSelect.value = "all";
    if (typeSelect) typeSelect.value = "all";
    applyFilters();
  });

  document.getElementById("destSearchForm")?.addEventListener("submit", e => {
    e.preventDefault();
    applyFilters();
  });

  applyFilters();
})();
