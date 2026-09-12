/* BOOKING.JS — Live database pricing sync, date rules, terms consent, & success redirect */
(() => {
  "use strict";

  const form = document.getElementById("bookingForm");
  if (!form) return;

  const packageSelect = document.getElementById("bookPackage");
  const travelersInput = document.getElementById("bookTravelers");
  const dateInput = document.getElementById("bookDate");
  const nameInput = document.getElementById("bookName");
  const phoneInput = document.getElementById("bookPhone");
  const emailInput = document.getElementById("bookEmail");
  const notesInput = document.getElementById("bookNotes");
  const consentCheck = document.getElementById("bookConsent");

  const rowPackage = document.getElementById("rowPackage");
  const rowTravelers = document.getElementById("rowTravelers");
  const rowSubtotal = document.getElementById("rowSubtotal");
  const totalEl = document.getElementById("bookTotal");
  const submitBtn = form.querySelector('button[type="submit"]');

  const currency = n => "₹" + Number(n).toLocaleString("en-IN");
  let availablePackages = [];

  // Enforce minimum 2-day advance notice on date picker
  if (dateInput) {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    dateInput.min = minDate.toISOString().split("T")[0];
  }

  async function initPackages() {
    try {
      const res = await fetch("/api/packages");
      if (!res.ok) throw new Error("Could not load packages");
      availablePackages = await res.json();

      if (packageSelect) {
        packageSelect.innerHTML = `<option value="" data-price="0">Select a package…</option>`;
        availablePackages.forEach(pkg => {
          const opt = document.createElement("option");
          opt.value = pkg.id;
          opt.dataset.price = pkg.price_per_person;
          opt.dataset.name = pkg.name;
          opt.textContent = `${pkg.name} — ${pkg.duration} — ${currency(pkg.price_per_person)}/person`;
          packageSelect.appendChild(opt);
        });

        // Pre-select package from URL parameter if passed (e.g. ?package=jatinga)
        const params = new URLSearchParams(window.location.search);
        const urlPkg = params.get("package") || params.get("id");
        if (urlPkg) {
          const match = availablePackages.find(p => p.id === urlPkg || p.slug === urlPkg);
          if (match) packageSelect.value = match.id;
        }
      }
      recalc();
    } catch (err) {
      console.error("Package sync error:", err);
    }
  }

  function recalc() {
    const opt = packageSelect?.selectedOptions[0];
    const price = parseInt(opt?.dataset.price || "0", 10);
    const name = opt?.dataset.name || opt?.textContent || "Select a package";
    const travelers = Math.max(parseInt(travelersInput?.value || "1", 10) || 1, 1);
    const subtotal = price * travelers;

    if (rowPackage) rowPackage.textContent = price ? name : "—";
    if (rowTravelers) rowTravelers.textContent = travelers;
    if (rowSubtotal) rowSubtotal.textContent = price ? `${currency(price)} × ${travelers}` : "—";
    if (totalEl) totalEl.textContent = price ? currency(subtotal) : "₹0";
  }

  packageSelect?.addEventListener("change", recalc);
  travelersInput?.addEventListener("input", recalc);

  function fieldError(field, message) {
    if (!field) return;
    field.setAttribute("aria-invalid", "true");
    field.style.borderColor = "#C9705F";
    let hint = field.parentElement?.querySelector(".err-hint");
    if (!hint) {
      hint = document.createElement("small");
      hint.className = "err-hint";
      hint.style.color = "#C9705F";
      hint.style.marginTop = "4px";
      hint.style.display = "block";
      field.parentElement?.appendChild(hint);
    }
    hint.textContent = message;
  }

  function clearError(field) {
    if (!field) return;
    field.removeAttribute("aria-invalid");
    field.style.borderColor = "";
    field.parentElement?.querySelector(".err-hint")?.remove();
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    let valid = true;

    [packageSelect, dateInput, nameInput, phoneInput, emailInput].forEach(field => clearError(field));

    if (!packageSelect?.value) { fieldError(packageSelect, "Please select a tour package"); valid = false; }
    if (!dateInput?.value) { fieldError(dateInput, "Please select a preferred start date"); valid = false; }
    if (!nameInput?.value.trim()) { fieldError(nameInput, "Enter your full name"); valid = false; }

    if (emailInput?.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
      fieldError(emailInput, "Enter a valid email address"); valid = false;
    } else if (!emailInput?.value.trim()) {
      fieldError(emailInput, "Email is required"); valid = false;
    }

    if (phoneInput?.value && phoneInput.value.replace(/\D/g, "").length < 10) {
      fieldError(phoneInput, "Enter a valid 10-digit phone number"); valid = false;
    } else if (!phoneInput?.value.trim()) {
      fieldError(phoneInput, "Phone number is required"); valid = false;
    }

    if (consentCheck && !consentCheck.checked) {
      fieldError(consentCheck, "You must agree to the Terms & Cancellation Policy to proceed.");
      valid = false;
    }

    if (!valid) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting Request…";

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: packageSelect.value,
          startDate: dateInput.value,
          travelers: Number(travelersInput.value),
          customerName: nameInput.value.trim(),
          phone: phoneInput.value.trim(),
          email: emailInput.value.trim(),
          notes: notesInput?.value.trim() || ""
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Booking request failed");

      // Redirect to dedicated booking success page
      const b = data.booking;
      const successUrl = `booking-success.html?ref=${encodeURIComponent(b.booking_reference)}&pkg=${encodeURIComponent(b.packageName)}&date=${encodeURIComponent(b.startDate)}&travelers=${encodeURIComponent(b.travelers)}&name=${encodeURIComponent(b.customerName)}&total=${encodeURIComponent(b.totalAmount)}`;
      window.location.href = successUrl;

    } catch (error) {
      console.error(error);
      window.showToast?.(error.message || "Could not submit booking. Please try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Request This Trip";
    }
  });

  document.addEventListener("DOMContentLoaded", initPackages);
})();
