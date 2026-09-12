/* AUTH.JS — Pure Popup Mode Customer Google Sign-In & User Avatar Dropdown Navigation */
(() => {
  "use strict";

  function firstName(fullName) {
    return String(fullName || "").trim().split(/\s+/)[0] || "Account";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
  }

  async function onGoogleCredential(response) {
    if (!response || !response.credential) {
      console.error("Google Sign-In: No credential returned in callback.");
      window.showToast?.("Google sign-in canceled or missing credential.");
      return;
    }

    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed");
      window.showToast?.(`Welcome, ${firstName(data.customer.name)}!`);
      setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      window.showToast?.(error.message || "Google sign-in failed. Please try again.");
    }
  }

  function waitForGoogleGIS(maxWaitMs = 10000) {
    return new Promise((resolve) => {
      if (window.google?.accounts?.id) return resolve(true);
      const start = Date.now();
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - start > maxWaitMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }

  async function renderSignedOut(slot) {
    slot.innerHTML = "";
    const mount = document.createElement("div");
    mount.id = "g_id_onload_mount";
    slot.appendChild(mount);

    try {
      const configRes = await fetch("/api/auth/config");
      const config = await configRes.json();
      if (!config.googleClientId) {
        console.warn("Google Client ID not configured on server.");
        return;
      }

      const isLoaded = await waitForGoogleGIS();
      if (!isLoaded || !window.google?.accounts?.id) {
        console.warn("Google Identity Services script failed to load within timeout.");
        return;
      }

      window.google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: onGoogleCredential,
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
        itp_support: true
      });

      window.google.accounts.id.renderButton(mount, {
        type: "standard",
        theme: "outline",
        size: "medium",
        text: "signin",
        shape: "rectangular",
        logo_alignment: "left",
        ux_mode: "popup"
      });
    } catch (error) {
      console.error("Error setting up Google Sign-In button:", error);
    }
  }

  function renderSignedIn(slot, customer) {
    slot.innerHTML = "";

    const name = customer.name || customer.email || "Account";
    const firstLetter = name.charAt(0).toUpperCase();

    const userWrap = document.createElement("div");
    userWrap.className = "auth-user-dropdown-wrap";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "auth-avatar-btn";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-label", `User menu for ${name}`);

    let avatarInner = "";
    if (customer.pictureUrl) {
      avatarInner = `<img src="${customer.pictureUrl}" alt="${escapeHtml(name)}" class="auth-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><span class="auth-avatar-initials" style="display:none;">${firstLetter}</span>`;
    } else {
      avatarInner = `<span class="auth-avatar-initials">${firstLetter}</span>`;
    }

    btn.innerHTML = `
      <span class="auth-avatar-circle">${avatarInner}</span>
      <svg class="auth-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    `;

    const menu = document.createElement("div");
    menu.className = "auth-dropdown-menu";
    menu.setAttribute("role", "menu");

    menu.innerHTML = `
      <div class="auth-dropdown-header">
        <div class="auth-dropdown-user-info">
          <strong class="auth-dropdown-name">${escapeHtml(name)}</strong>
          <span class="auth-dropdown-email">${escapeHtml(customer.email || "")}</span>
        </div>
      </div>
      <div class="auth-dropdown-divider"></div>
      <div class="auth-dropdown-items">
        <a href="my-bookings.html" class="auth-dropdown-item" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <span>My Bookings</span>
        </a>
        <a href="my-bookings.html#history" class="auth-dropdown-item" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Booking History</span>
        </a>
        <a href="contact.html" class="auth-dropdown-item" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Support & Help</span>
        </a>
      </div>
      <div class="auth-dropdown-divider"></div>
      <button type="button" class="auth-dropdown-item auth-dropdown-logout" id="dropdownLogoutBtn" role="menuitem">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        <span>Sign out</span>
      </button>
    `;

    userWrap.appendChild(btn);
    userWrap.appendChild(menu);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains("show");
      closeAllDropdowns();
      if (!isOpen) {
        menu.classList.add("show");
        btn.setAttribute("aria-expanded", "true");
      }
    });

    menu.querySelector("#dropdownLogoutBtn")?.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
        window.showToast?.("Signed out.");
        setTimeout(() => window.location.reload(), 400);
      } catch (err) {
        window.location.reload();
      }
    });

    slot.appendChild(userWrap);
  }

  function closeAllDropdowns() {
    document.querySelectorAll(".auth-dropdown-menu.show").forEach(m => m.classList.remove("show"));
    document.querySelectorAll(".auth-avatar-btn[aria-expanded='true']").forEach(b => b.setAttribute("aria-expanded", "false"));
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".auth-user-dropdown-wrap")) {
      closeAllDropdowns();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllDropdowns();
  });

  async function initAuth() {
    const slot = document.getElementById("authSlot") || document.querySelector(".nav-auth");
    if (!slot) return;

    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.customer) {
          renderSignedIn(slot, data.customer);
          return;
        }
      }
    } catch (error) {
      console.warn("Customer auth check failed:", error);
    }

    renderSignedOut(slot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }
})();
