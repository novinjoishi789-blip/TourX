/* PACKAGES.JS — Dynamic package fetching & responsive search multi-filter */
(() => {
  "use strict";

  let allPackages = [];
  const container = document.getElementById("packagesGrid");
  const searchInput = document.getElementById("filterSearch");
  const durationSelect = document.getElementById("filterDuration");
  const priceSelect = document.getElementById("filterPrice");
  const difficultySelect = document.getElementById("filterDifficulty");
  const emptyState = document.getElementById("emptyState");

  const currency = n => "₹" + Number(n).toLocaleString("en-IN");

  async function loadPackages() {
    if (!container) return;
    try {
      const res = await fetch("/api/packages");
      if (!res.ok) throw new Error("Failed to load packages");
      allPackages = await res.json();
      renderPackages(allPackages);
    } catch (err) {
      console.error(err);
      if (container) {
        container.innerHTML = `<div class="error-box" style="grid-column:1/-1; text-align:center; padding:40px; background:var(--surface-color, #fff); border-radius:12px;"><p style="color:#c9705f;">Unable to load package catalog. Please refresh or try again later.</p></div>`;
      }
    }
  }

  function filterPackages() {
    const q = (searchInput?.value || "").toLowerCase().trim();
    const dur = durationSelect?.value || "all";
    const pr = priceSelect?.value || "all";
    const diff = difficultySelect?.value || "all";

    const filtered = allPackages.filter(pkg => {
      // Search text match
      const textMatch = !q || pkg.name.toLowerCase().includes(q) || (pkg.short_description || "").toLowerCase().includes(q) || (pkg.description || "").toLowerCase().includes(q);

      // Duration filter
      let durationMatch = true;
      if (dur === "weekend") durationMatch = (pkg.duration_days <= 2);
      else if (dur === "multi") durationMatch = (pkg.duration_days === 3 || pkg.duration_days === 4);
      else if (dur === "extended") durationMatch = (pkg.duration_days >= 5);

      // Price filter
      let priceMatch = true;
      if (pr === "under5k") priceMatch = (pkg.price_per_person < 5000);
      else if (pr === "5k-8k") priceMatch = (pkg.price_per_person >= 5000 && pkg.price_per_person <= 8000);
      else if (pr === "over8k") priceMatch = (pkg.price_per_person > 8000);

      // Difficulty filter
      let difficultyMatch = true;
      if (diff !== "all") {
        difficultyMatch = (pkg.difficulty || "").toLowerCase().includes(diff.toLowerCase());
      }

      return textMatch && durationMatch && priceMatch && difficultyMatch;
    });

    renderPackages(filtered);
  }

  function renderPackages(packages) {
    if (!container) return;
    container.innerHTML = "";

    if (!packages.length) {
      if (emptyState) emptyState.hidden = false;
      return;
    }
    if (emptyState) emptyState.hidden = true;

    packages.forEach(pkg => {
      const card = document.createElement("div");
      card.className = "tilt pkg-card-wrap";

      const slugOrId = pkg.slug || pkg.id;
      const detailUrl = `package-detail.html?slug=${encodeURIComponent(slugOrId)}`;
      const bookUrl = `booking.html?package=${encodeURIComponent(pkg.id)}`;

      card.innerHTML = `
        <div class="tilt-inner pkg-card">
          <div class="media">
            <img src="${pkg.image || 'assets/images/packages/jatinga-mystery-weekend.jpeg'}" alt="${pkg.name}" loading="lazy">
            <span class="tag ${pkg.featured ? 'gold' : ''}">${pkg.duration}${pkg.featured ? ' · Featured' : ''}</span>
            <div class="tilt-glare"></div>
          </div>
          <div class="body">
            <h3><a href="${detailUrl}" style="color:inherit; text-decoration:none;">${pkg.name}</a></h3>
            <p>${pkg.short_description || pkg.description || ''}</p>
            <div class="feature-chips">
              <span>${pkg.difficulty || 'Easy'}</span>
              <span>Max ${pkg.max_travelers || 12} People</span>
              <span>${pkg.best_season || 'Oct–Apr'}</span>
            </div>
            <div class="price-row" style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div class="from" style="font-size:12px; color:#666;">Per person</div>
                <div class="amount" style="font-size:20px; font-weight:700;">${currency(pkg.price_per_person)}</div>
              </div>
              <div style="display:flex; gap:8px;">
                <a href="${detailUrl}" class="btn btn-secondary btn-sm" style="padding:6px 14px; font-size:13px; text-decoration:none; border-radius:6px; border:1px solid #ccc; background:#fff; color:#333;">Details</a>
                <a href="${bookUrl}" class="btn btn-primary btn-sm" style="padding:6px 14px; font-size:13px; text-decoration:none; border-radius:6px; background:#C9705F; color:#fff;">Request Trip</a>
              </div>
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  searchInput?.addEventListener("input", filterPackages);
  durationSelect?.addEventListener("change", filterPackages);
  priceSelect?.addEventListener("change", filterPackages);
  difficultySelect?.addEventListener("change", filterPackages);

  document.addEventListener("DOMContentLoaded", loadPackages);
})();
