/* PACKAGE-DETAIL.JS — Dynamic rendering of full package details, itinerary timeline, and inclusions */
(() => {
  "use strict";

  const currency = n => "₹" + Number(n).toLocaleString("en-IN");

  async function initPackageDetail() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug") || params.get("id");

    if (!slug) {
      window.location.href = "packages.html";
      return;
    }

    try {
      const res = await fetch(`/api/packages/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error("Package not found");
      const pkg = await res.json();

      document.title = `${pkg.name} — Explore Dima Hasao`;

      // Update Meta Tags
      document.querySelector('meta[name="description"]')?.setAttribute("content", pkg.short_description || pkg.description || "");

      // Render Hero
      const heroBg = document.getElementById("detailHeroBg");
      if (heroBg) heroBg.style.backgroundImage = `url('${pkg.image || 'assets/images/packages/jatinga-mystery-weekend.jpeg'}')`;

      document.getElementById("detailTitle").textContent = pkg.name;
      document.getElementById("detailTag").textContent = `${pkg.duration} · ${pkg.difficulty || 'Easy'}`;
      document.getElementById("detailPrice").textContent = currency(pkg.price_per_person);

      // Meta Stats
      document.getElementById("metaDuration").textContent = pkg.duration;
      document.getElementById("metaDifficulty").textContent = pkg.difficulty || "Easy";
      document.getElementById("metaMaxTravelers").textContent = `Max ${pkg.max_travelers || 12} People`;
      document.getElementById("metaSeason").textContent = pkg.best_season || "October to April";
      document.getElementById("metaMeetingPoint").textContent = pkg.meeting_point || "Haflong Town";

      // Overview
      document.getElementById("detailDescription").textContent = pkg.description || pkg.short_description;

      // Render Itinerary Timeline
      const itinList = document.getElementById("itineraryList");
      if (itinList) {
        itinList.innerHTML = "";
        if (pkg.itinerary && pkg.itinerary.length) {
          pkg.itinerary.forEach((day, idx) => {
            const item = document.createElement("div");
            item.className = "itinerary-day";
            item.style.marginBottom = "24px";
            item.style.paddingLeft = "20px";
            item.style.borderLeft = "3px solid #C9705F";
            item.innerHTML = `
              <h4 style="margin:0 0 6px 0; color:#C9705F; font-size:16px;">DAY ${day.day_number || idx + 1}: ${day.title}</h4>
              <p style="margin:0; color:#444; line-height:1.6;">${day.description}</p>
            `;
            itinList.appendChild(item);
          });
        } else {
          itinList.innerHTML = "<p style='color:#666;'>Detailed day-by-day itinerary provided upon booking request confirmation.</p>";
        }
      }

      // Inclusions & Exclusions
      const incList = document.getElementById("inclusionsList");
      if (incList) {
        incList.innerHTML = "";
        (pkg.inclusions || []).forEach(inc => {
          const li = document.createElement("li");
          li.style.marginBottom = "8px";
          li.style.listStyle = "none";
          li.innerHTML = `<span style="color:#2E7D32; font-weight:bold; margin-right:8px;">✓</span> ${inc}`;
          incList.appendChild(li);
        });
      }

      const excList = document.getElementById("exclusionsList");
      if (excList) {
        excList.innerHTML = "";
        (pkg.exclusions || []).forEach(exc => {
          const li = document.createElement("li");
          li.style.marginBottom = "8px";
          li.style.listStyle = "none";
          li.innerHTML = `<span style="color:#C9705F; font-weight:bold; margin-right:8px;">✕</span> ${exc}`;
          excList.appendChild(li);
        });
      }

      // Action CTAs
      const bookBtn = document.getElementById("btnBookRequest");
      if (bookBtn) bookBtn.href = `booking.html?package=${encodeURIComponent(pkg.id)}`;

      const waBtn = document.getElementById("btnWhatsAppInquire");
      if (waBtn) {
        const text = encodeURIComponent(`Hello Explore Dima Hasao, I have an inquiry about the "${pkg.name}" (${pkg.duration}, ${currency(pkg.price_per_person)} per person). Can you confirm availability?`);
        waBtn.href = `https://wa.me/918099774793?text=${text}`;
      }

      // JSON-LD Tour Structured Data
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "TouristTrip",
        "name": pkg.name,
        "description": pkg.short_description || pkg.description,
        "touristType": [pkg.difficulty],
        "offers": {
          "@type": "Offer",
          "price": pkg.price_per_person,
          "priceCurrency": "INR",
          "availability": "https://schema.org/InStock"
        }
      });
      document.head.appendChild(script);

      // Load related packages
      loadRelatedPackages(pkg.id);

    } catch (err) {
      console.error(err);
      document.getElementById("detailMainContent").innerHTML = `
        <div style="text-align:center; padding:80px 20px;">
          <h2>Package Not Found</h2>
          <p style="color:#666; margin-bottom:20px;">The requested tour package could not be found.</p>
          <a href="packages.html" class="btn btn-primary">Back to Packages</a>
        </div>
      `;
    }
  }

  async function loadRelatedPackages(currentId) {
    const relGrid = document.getElementById("relatedPackagesGrid");
    if (!relGrid) return;
    try {
      const res = await fetch("/api/packages");
      const packages = await res.json();
      const related = packages.filter(p => p.id !== currentId).slice(0, 3);
      relGrid.innerHTML = "";

      related.forEach(pkg => {
        const card = document.createElement("div");
        card.className = "pkg-card-wrap";
        card.innerHTML = `
          <div class="pkg-card" style="background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
            <div style="height:160px; overflow:hidden;">
              <img src="${pkg.image || 'assets/images/packages/jatinga-mystery-weekend.jpeg'}" alt="${pkg.name}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div style="padding:16px;">
              <h4 style="margin:0 0 8px 0; font-size:16px;"><a href="package-detail.html?slug=${pkg.slug || pkg.id}" style="color:inherit; text-decoration:none;">${pkg.name}</a></h4>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
                <span style="font-weight:700; color:#C9705F;">${currency(pkg.price_per_person)}</span>
                <a href="package-detail.html?slug=${pkg.slug || pkg.id}" style="font-size:13px; color:#333; text-decoration:none; font-weight:600;">View →</a>
              </div>
            </div>
          </div>
        `;
        relGrid.appendChild(card);
      });
    } catch (e) {
      console.warn("Could not load related packages", e);
    }
  }

  document.addEventListener("DOMContentLoaded", initPackageDetail);
})();
