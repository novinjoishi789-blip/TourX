/* MY-BOOKINGS.JS — Enhanced Customer Booking Dashboard & Guest Booking Claim System */
(() => {
  "use strict";

  const listEl = document.getElementById("myBookingsList");
  const emptyEl = document.getElementById("myBookingsEmpty");
  const signedOutEl = document.getElementById("myBookingsSignedOut");
  const claimForm = document.getElementById("claimBookingForm");

  const currency = n => "₹" + Number(n).toLocaleString("en-IN");
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  function statusBadge(status) {
    const s = String(status || "").toUpperCase();
    let bg = "#FFF3E0", color = "#E65100";
    if (s === "CONFIRMED") { bg = "#E8F5E9"; color = "#2E7D32"; }
    else if (s === "CANCELLED") { bg = "#FFEBEE"; color = "#C62828"; }
    else if (s === "COMPLETED") { bg = "#E3F2FD"; color = "#1565C0"; }
    return `<span style="background:${bg}; color:${color}; font-size:12px; font-weight:700; padding:4px 10px; border-radius:20px; text-transform:uppercase;">${s}</span>`;
  }

  function renderBookings(bookings) {
    if (!listEl) return;
    if (!bookings.length) {
      if (emptyEl) emptyEl.style.display = "block";
      listEl.innerHTML = "";
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";

    listEl.innerHTML = bookings.map(b => {
      const startDate = b.start_date ? new Date(b.start_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const waText = encodeURIComponent(`Hello Explore Dima Hasao, I am inquiring about my booking request ${b.booking_reference} for ${b.package_name}.`);

      return `
        <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:16px; box-shadow:0 4px 15px rgba(0,0,0,0.05); border:1px solid #EAEAEA;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <div>
              <span style="font-size:11px; text-transform:uppercase; color:#888; font-weight:700; display:block;">Reference: ${escapeHtml(b.booking_reference)}</span>
              <h3 style="margin:4px 0 0 0; font-size:18px;">${escapeHtml(b.package_name)}</h3>
            </div>
            <div>${statusBadge(b.status)}</div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:12px; font-size:14px; background:#F9F9FB; padding:12px; border-radius:8px; margin-bottom:14px;">
            <div><span style="color:#777; font-size:12px; display:block;">Departure</span><strong>${startDate}</strong></div>
            <div><span style="color:#777; font-size:12px; display:block;">Travelers</span><strong>${b.travelers} Person(s)</strong></div>
            <div><span style="color:#777; font-size:12px; display:block;">Total Price</span><strong style="color:#C9705F;">${currency(b.total_amount)}</strong></div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <a href="https://wa.me/918099774793?text=${waText}" target="_blank" rel="noopener" style="font-size:13px; color:#25D366; font-weight:600; text-decoration:none;">💬 WhatsApp Support for this Booking</a>
            <span style="font-size:12px; color:#888;">Requested on ${new Date(b.created_at).toLocaleDateString('en-IN')}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  async function loadBookings() {
    try {
      const res = await fetch("/api/my/bookings");
      if (res.status === 401) {
        if (signedOutEl) signedOutEl.style.display = "block";
        if (listEl) listEl.innerHTML = "";
        return;
      }
      if (signedOutEl) signedOutEl.style.display = "none";
      if (!res.ok) throw new Error("Could not load bookings.");
      const bookings = await res.json();
      renderBookings(bookings);
    } catch (error) {
      console.error(error);
      window.showToast?.("Could not load your bookings.");
    }
  }

  // Handle Guest Booking Claim Submission
  if (claimForm) {
    claimForm.addEventListener("submit", async e => {
      e.preventDefault();
      const refInput = document.getElementById("claimRef");
      const emailInput = document.getElementById("claimEmail");
      const submitBtn = claimForm.querySelector("button[type='submit']");

      if (!refInput?.value.trim() || !emailInput?.value.trim()) {
        window.showToast?.("Please enter both booking reference and email.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Linking...";

      try {
        const res = await fetch("/api/bookings/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: refInput.value.trim(),
            email: emailInput.value.trim()
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Claim failed");

        window.showToast?.("Booking successfully linked to your account!");
        claimForm.reset();
        await loadBookings();
      } catch (err) {
        window.showToast?.(err.message || "Could not link booking.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Link to My Account";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", loadBookings);
})();
