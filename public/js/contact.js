/* CONTACT.JS — Form validation, Custom Trip request submission, & FAQ accordion */
(() => {
  "use strict";
  const contactForm = document.getElementById("contactForm");
  const customTripForm = document.getElementById("customTripForm");

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

  // Handle Contact Message Form
  if (contactForm) {
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    contactForm.addEventListener("submit", async e => {
      e.preventDefault();
      let valid = true;
      contactForm.querySelectorAll("[required]").forEach(field => {
        clearError(field);
        if (!field.value.trim()) {
          fieldError(field, "This field is required");
          valid = false;
        }
      });
      const email = document.getElementById("contactEmail");
      if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        fieldError(email, "Enter a valid email address");
        valid = false;
      }
      if (!valid) {
        contactForm.querySelector('[aria-invalid="true"]')?.focus();
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
      try {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: document.getElementById("contactName").value.trim(),
            email: email.value.trim(),
            subject: document.getElementById("contactSubject").value.trim(),
            message: document.getElementById("contactMessage").value.trim()
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Message failed");
        window.showToast?.("Message received — we'll reply within a day!");
        contactForm.reset();
      } catch (error) {
        console.error(error);
        window.showToast?.(error.message || "Could not send message. Please try again.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      }
    });
  }

  // Handle Custom Trip Request Form ("Build My Trip")
  if (customTripForm) {
    const submitBtn = customTripForm.querySelector('button[type="submit"]');
    customTripForm.addEventListener("submit", async e => {
      e.preventDefault();
      let valid = true;

      customTripForm.querySelectorAll("[required]").forEach(field => {
        clearError(field);
        if (!field.value.trim()) {
          fieldError(field, "This field is required");
          valid = false;
        }
      });

      const email = document.getElementById("ctEmail");
      if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        fieldError(email, "Enter a valid email address");
        valid = false;
      }

      if (!valid) {
        customTripForm.querySelector('[aria-invalid="true"]')?.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting Custom Trip Request…";

      try {
        const response = await fetch("/api/custom-trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: document.getElementById("ctName")?.value.trim() || "",
            email: email?.value.trim() || "",
            phone: document.getElementById("ctPhone")?.value.trim() || "",
            travelDates: document.getElementById("ctDates")?.value.trim() || "",
            travelers: Number(document.getElementById("ctTravelers")?.value || 1),
            budget: document.getElementById("ctBudget")?.value || "",
            interests: document.getElementById("ctInterests")?.value.trim() || "",
            trekkingPref: document.getElementById("ctTrekking")?.value || "",
            accommodationPref: document.getElementById("ctAccommodation")?.value || "",
            destinations: document.getElementById("ctDestinations")?.value.trim() || "",
            specialReqs: document.getElementById("ctSpecial")?.value.trim() || ""
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Custom trip request failed");

        window.showToast?.(`Custom trip request ${data.reference} submitted! We'll craft your itinerary.`);
        customTripForm.reset();
      } catch (error) {
        console.error(error);
        window.showToast?.(error.message || "Could not submit request.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Custom Trip Plan";
      }
    });
  }

  /* FAQ accordion */
  document.querySelectorAll(".faq-item").forEach(item => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    q?.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(other => {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".faq-a").style.maxHeight = null;
          other.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        }
      });
      item.classList.toggle("open", !isOpen);
      q.setAttribute("aria-expanded", String(!isOpen));
      a.style.maxHeight = !isOpen ? a.scrollHeight + "px" : null;
    });
  });
})();
