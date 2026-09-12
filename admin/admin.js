(() => {
  "use strict";

  const loginView = document.getElementById('loginView');
  const appView = document.getElementById('appView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  const rows = document.getElementById('bookingRows');
  const packageRows = document.getElementById('packageRows');
  const customTripRows = document.getElementById('customTripRows');
  const messageRows = document.getElementById('messageRows');
  const auditRows = document.getElementById('auditRows');
  const stats = document.getElementById('stats');
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');

  let currentStatus = 'ALL';
  let currentSearchQuery = '';
  let activeTab = 'tabBookings';

  async function api(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  const money = n => `₹${Number(n).toLocaleString('en-IN')}`;
  const dateStr = value => value ? new Date(value).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  async function checkAuth() {
    try {
      const data = await api('/api/admin/me');
      if (document.getElementById('adminUserBadge')) {
        document.getElementById('adminUserBadge').textContent = `Logged in as ${data.admin.email}`;
      }
      showApp();
    } catch {
      showLogin();
    }
  }

  function showLogin() { loginView.hidden = false; appView.hidden = true; }
  function showApp() { loginView.hidden = true; appView.hidden = false; loadAll(); }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.textContent = '';
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: emailInput.value, password: passwordInput.value })
      });
      checkAuth();
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    showLogin();
  });

  document.getElementById('refreshBtn').addEventListener('click', loadAll);

  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(x => x.hidden = true);
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      document.getElementById(activeTab).hidden = false;
      loadTabContent(activeTab);
    });
  });

  // Booking Search & Filters
  document.querySelectorAll('#statusTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#statusTabs button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      loadBookings();
    });
  });

  const searchInput = document.getElementById('bookingSearch');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        currentSearchQuery = searchInput.value;
        loadBookings();
      }, 300);
    });
  }

  // Modal Controls
  document.getElementById('modalClose').addEventListener('click', () => modal.hidden = true);
  modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

  async function loadAll() {
    await Promise.all([loadStats(), loadBookings()]);
  }

  function loadTabContent(tabId) {
    if (tabId === 'tabBookings') loadBookings();
    else if (tabId === 'tabPackages') loadPackages();
    else if (tabId === 'tabCustomTrips') loadCustomTrips();
    else if (tabId === 'tabMessages') loadMessages();
    else if (tabId === 'tabSettings') loadSettings();
    else if (tabId === 'tabAudit') loadAuditLogs();
  }

  async function loadStats() {
    try {
      const s = await api('/api/admin/stats');
      stats.innerHTML = [
        ['Total Bookings', s.total],
        ['Pending Requests', s.pending],
        ['Confirmed', s.confirmed],
        ['Completed', s.completed],
        ['Cancelled', s.cancelled],
        ['Unread Inbox', s.unreadMessages],
        ['Custom Trips', s.pendingCustomTrips || 0]
      ].map(([label, num]) => `
        <div class="stat">
          <div class="label">${label}</div>
          <div class="num">${num}</div>
        </div>
      `).join('');
    } catch (e) { console.error(e); }
  }

  // Bookings Loader & Modal
  async function loadBookings() {
    try {
      const queryUrl = `/api/admin/bookings?status=${encodeURIComponent(currentStatus)}&q=${encodeURIComponent(currentSearchQuery)}`;
      const data = await api(queryUrl);
      if (document.getElementById('bookingCount')) {
        document.getElementById('bookingCount').textContent = `${data.length} booking request${data.length === 1 ? '' : 's'}`;
      }
      rows.innerHTML = data.length ? data.map(b => `
        <tr>
          <td><strong>${escape(b.booking_reference)}</strong></td>
          <td>${escape(b.customer_name)}<br><span class="muted">${escape(b.phone)}</span><br><span class="muted">${escape(b.email)}</span></td>
          <td>${escape(b.package_name)}</td>
          <td>${dateStr(b.start_date)}</td>
          <td>${b.travelers}</td>
          <td>${money(b.total_amount)}</td>
          <td><span class="status status-${b.status}">${b.status}</span></td>
          <td>
            <button class="linkbtn" data-booking-id="${b.id}">Manage</button>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="8" class="muted" style="text-align:center; padding:30px;">No bookings found matching current filters.</td></tr>';

      rows.querySelectorAll('[data-booking-id]').forEach(btn => {
        btn.addEventListener('click', () => openBookingModal(btn.dataset.bookingId));
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function openBookingModal(id) {
    try {
      const b = await api(`/api/admin/bookings/${id}`);
      const cleanPhone = String(b.phone || '').replace(/[^\d+]/g, '');
      const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${b.customer_name}, regarding your Dima Hasao booking request ${b.booking_reference} for ${b.package_name}...`)}`;

      let historyHtml = '';
      if (b.history && b.history.length) {
        historyHtml = `<div class="timeline" style="margin-top:16px;">` + b.history.map(h => `
          <div class="timeline-item">
            <div class="time">${dateStr(h.created_at)} — <strong>${escape(h.actor)}</strong> changed status to <span class="status status-${h.new_status}">${h.new_status}</span></div>
            ${h.note ? `<div style="font-size:12px; color:#555; margin-top:2px;">"${escape(h.note)}"` : ''}</div>
          </div>
        `).join('') + `</div>`;
      } else {
        historyHtml = `<p class="muted" style="font-size:12px;">No previous status history.</p>`;
      }

      modalBody.innerHTML = `
        <p class="eyebrow">${escape(b.booking_reference)}</p>
        <h2 style="margin:0 0 12px 0;">${escape(b.customer_name)}</h2>

        <div class="detail-grid">
          <div class="detail"><b>Phone</b>${escape(b.phone)} <br><a href="tel:${escape(b.phone)}" style="font-size:12px; color:#1d4d3b;">📞 Call Customer</a></div>
          <div class="detail"><b>Email</b>${escape(b.email)}</div>
          <div class="detail"><b>Package</b>${escape(b.package_name)}</div>
          <div class="detail"><b>Start date</b>${dateStr(b.start_date)}</div>
          <div class="detail"><b>Travelers</b>${b.travelers} Person(s)</div>
          <div class="detail"><b>Price / person</b>${money(b.price_per_person)}</div>
          <div class="detail"><b>Total Amount</b>${money(b.total_amount)}</div>
          <div class="detail"><b>Current Status</b><span class="status status-${b.status}">${b.status}</span></div>
        </div>

        <div style="margin-top:16px;">
          <a href="${waLink}" target="_blank" rel="noopener" class="primary" style="display:inline-block; text-decoration:none; background:#25D366; padding:8px 14px; font-size:13px;">
            💬 Open Customer WhatsApp Chat
          </a>
        </div>

        <div class="detail" style="margin-top:16px;">
          <b>Special Requests & Notes (Customer Submitted)</b>
          ${escape(b.notes) || 'None provided'}
        </div>

        <div style="margin-top:20px; border-top:1px solid #eee; padding-top:16px;">
          <h4 style="margin:0 0 8px 0;">Update Booking Status & Send Customer Notification</h4>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <input type="text" id="statusNoteInput" placeholder="Optional operator note for customer email..." style="flex:1; padding:8px 10px; border:1px solid #ccc; border-radius:6px; font-size:13px;">
          </div>
          <div class="actions" style="margin-top:10px;">
            <button class="primary" data-set-status="CONFIRMED">✓ Confirm Booking</button>
            <button class="ghost" data-set-status="PENDING">Set Pending</button>
            <button class="ghost" data-set-status="COMPLETED">Mark Completed</button>
            <button class="ghost" data-set-status="CANCELLED" style="color:#C62828;">Cancel Booking</button>
          </div>
        </div>

        <div style="margin-top:24px; border-top:1px solid #eee; padding-top:16px;">
          <h4 style="margin:0 0 8px 0;">Booking Lifecycle Audit History</h4>
          ${historyHtml}
        </div>
      `;

      modal.hidden = false;

      modalBody.querySelectorAll('[data-set-status]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const newStatus = btn.dataset.setStatus;
          const note = document.getElementById('statusNoteInput')?.value || '';
          try {
            await api(`/api/admin/bookings/${id}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: newStatus, note })
            });
            modal.hidden = true;
            await loadAll();
          } catch (err) {
            alert(err.message || 'Could not update status');
          }
        });
      });

    } catch (err) {
      alert(err.message || 'Could not fetch booking details');
    }
  }

  // Packages Management CRUD
  async function loadPackages() {
    try {
      const packages = await api('/api/packages?all=true');
      packageRows.innerHTML = packages.map(p => `
        <tr>
          <td><strong>${escape(p.name)}</strong><br><span class="muted">${escape(p.slug || p.id)}</span></td>
          <td>${money(p.price_per_person)}</td>
          <td>${escape(p.duration)}</td>
          <td>${escape(p.difficulty)}</td>
          <td>${p.featured ? '⭐ Featured' : 'Normal'}</td>
          <td>
            <span class="status ${p.active ? 'status-CONFIRMED' : 'status-CANCELLED'}">
              ${p.active ? 'Active' : 'Inactive / Archived'}
            </span>
          </td>
          <td>
            <button class="linkbtn" data-edit-pkg="${p.id}">Edit</button>
            <button class="linkbtn" data-toggle-pkg="${p.id}" data-active="${p.active}">${p.active ? 'Deactivate' : 'Activate'}</button>
          </td>
        </tr>
      `).join('');

      packageRows.querySelectorAll('[data-edit-pkg]').forEach(btn => {
        btn.addEventListener('click', () => openPackageEditModal(btn.dataset.editPkg));
      });

      packageRows.querySelectorAll('[data-toggle-pkg]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pkgId = btn.dataset.togglePkg;
          const active = btn.dataset.active !== 'true';
          await api(`/api/admin/packages/${pkgId}/active`, {
            method: 'PATCH',
            body: JSON.stringify({ active })
          });
          loadPackages();
        });
      });

    } catch (err) {
      console.error(err);
    }
  }

  document.getElementById('btnCreatePackage')?.addEventListener('click', () => openPackageEditModal(null));

  async function openPackageEditModal(pkgId) {
    let pkg = {
      id: '', name: '', slug: '', price_per_person: 5000, duration: '2D / 1N', duration_days: 2, duration_nights: 1,
      short_description: '', description: '', difficulty: 'Easy', best_season: 'October to April',
      meeting_point: 'Haflong Town', max_travelers: 12, featured: false, active: true, image: 'assets/images/packages/jatinga-mystery-weekend.jpeg',
      itinerary: [], inclusions: [], exclusions: []
    };

    if (pkgId) {
      try {
        pkg = await api(`/api/packages/${pkgId}`);
      } catch (err) {
        alert("Could not load package details"); return;
      }
    }

    modalBody.innerHTML = `
      <h2 style="margin:0 0 16px 0;">${pkgId ? 'Edit Package' : 'Create New Package'}</h2>
      <form id="pkgForm" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <label>Package Name *<input id="p_name" type="text" value="${escape(pkg.name)}" required></label>
        <label>URL Slug<input id="p_slug" type="text" value="${escape(pkg.slug || '')}" placeholder="jatinga-mystery-weekend"></label>
        <label>Price Per Person (₹) *<input id="p_price" type="number" value="${pkg.price_per_person}" required></label>
        <label>Duration Label *<input id="p_duration" type="text" value="${escape(pkg.duration)}" placeholder="3D / 2N" required></label>
        <label>Duration Days<input id="p_days" type="number" value="${pkg.duration_days}"></label>
        <label>Duration Nights<input id="p_nights" type="number" value="${pkg.duration_nights}"></label>
        <label>Difficulty Level<input id="p_difficulty" type="text" value="${escape(pkg.difficulty)}"></label>
        <label>Best Season<input id="p_season" type="text" value="${escape(pkg.best_season)}"></label>
        <label>Meeting Point<input id="p_meeting" type="text" value="${escape(pkg.meeting_point)}"></label>
        <label>Max Travelers<input id="p_max" type="number" value="${pkg.max_travelers}"></label>
        <label style="grid-column:1/-1;">Image URL Path<input id="p_image" type="text" value="${escape(pkg.image)}"></label>
        <label style="grid-column:1/-1;">Short Summary<input id="p_short" type="text" value="${escape(pkg.short_description)}"></label>
        <label style="grid-column:1/-1;">Full Detailed Description<textarea id="p_desc">${escape(pkg.description)}</textarea></label>
        
        <div style="grid-column:1/-1; display:flex; gap:16px; align-items:center;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input id="p_featured" type="checkbox" ${pkg.featured ? 'checked' : ''}> Featured Package</label>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input id="p_active" type="checkbox" ${pkg.active ? 'checked' : ''}> Active in Catalog</label>
        </div>

        <div style="grid-column:1/-1; margin-top:12px;">
          <button type="submit" class="primary" style="width:100%; padding:12px;">Save Package Data</button>
        </div>
      </form>
    `;

    modal.hidden = false;

    document.getElementById('pkgForm').addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('p_name').value.trim(),
        slug: document.getElementById('p_slug').value.trim(),
        price_per_person: Number(document.getElementById('p_price').value),
        duration: document.getElementById('p_duration').value.trim(),
        duration_days: Number(document.getElementById('p_days').value),
        duration_nights: Number(document.getElementById('p_nights').value),
        difficulty: document.getElementById('p_difficulty').value.trim(),
        best_season: document.getElementById('p_season').value.trim(),
        meeting_point: document.getElementById('p_meeting').value.trim(),
        max_travelers: Number(document.getElementById('p_max').value),
        image: document.getElementById('p_image').value.trim(),
        short_description: document.getElementById('p_short').value.trim(),
        description: document.getElementById('p_desc').value.trim(),
        featured: document.getElementById('p_featured').checked,
        active: document.getElementById('p_active').checked
      };

      try {
        if (pkgId) {
          await api(`/api/admin/packages/${pkgId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await api('/api/admin/packages', { method: 'POST', body: JSON.stringify(payload) });
        }
        modal.hidden = true;
        loadPackages();
      } catch (err) {
        alert(err.message || 'Could not save package');
      }
    });
  }

  // Custom Trip Requests Loader
  async function loadCustomTrips() {
    try {
      const trips = await api('/api/admin/custom-trips');
      if (document.getElementById('customTripCount')) {
        document.getElementById('customTripCount').textContent = `${trips.length} custom trip request${trips.length === 1 ? '' : 's'}`;
      }

      customTripRows.innerHTML = trips.length ? trips.map(t => `
        <tr>
          <td><strong>${escape(t.reference)}</strong></td>
          <td>${escape(t.customer_name)}<br><span class="muted">${escape(t.phone)}</span><br><span class="muted">${escape(t.email)}</span></td>
          <td>${escape(t.travel_dates)}</td>
          <td>${t.travelers}</td>
          <td>${escape(t.budget)}</td>
          <td><span class="status status-${t.status}">${t.status}</span></td>
          <td>
            <button class="linkbtn" data-ct-id="${t.id}">View Details</button>
          </td>
        </tr>
      `).join('') : '<tr><td colspan="7" class="muted" style="text-align:center; padding:30px;">No custom trip inquiries yet.</td></tr>';

      customTripRows.querySelectorAll('[data-ct-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = trips.find(x => String(x.id) === btn.dataset.ctId);
          openCustomTripModal(t);
        });
      });

    } catch (err) {
      console.error(err);
    }
  }

  function openCustomTripModal(t) {
    modalBody.innerHTML = `
      <p class="eyebrow">${escape(t.reference)}</p>
      <h2>Custom Trip Request: ${escape(t.customer_name)}</h2>
      
      <div class="detail-grid">
        <div class="detail"><b>Phone</b>${escape(t.phone)} <br><a href="tel:${escape(t.phone)}" style="font-size:12px;">📞 Call</a></div>
        <div class="detail"><b>Email</b>${escape(t.email)}</div>
        <div class="detail"><b>Travel Dates</b>${escape(t.travel_dates)}</div>
        <div class="detail"><b>Travelers</b>${t.travelers}</div>
        <div class="detail"><b>Budget</b>${escape(t.budget)}</div>
        <div class="detail"><b>Trekking Preference</b>${escape(t.trekking_pref)}</div>
        <div class="detail"><b>Accommodation</b>${escape(t.accommodation_pref)}</div>
        <div class="detail"><b>Destinations / Must-See</b>${escape(t.destinations)}</div>
      </div>

      <div class="detail" style="margin-top:14px;">
        <b>Special Requirements & Message</b>
        ${escape(t.special_reqs) || 'None'}
      </div>

      <div class="actions">
        <button class="primary" data-set-ct="REVIEWED">Mark Reviewed</button>
        <button class="ghost" data-set-ct="CONTACTED">Mark Contacted</button>
        <button class="ghost" data-set-ct="ARCHIVED">Archive</button>
      </div>
    `;
    modal.hidden = false;

    modalBody.querySelectorAll('[data-set-ct]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/api/admin/custom-trips/${t.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: btn.dataset.setCt })
        });
        modal.hidden = true;
        loadCustomTrips();
      });
    });
  }

  // Messages Loader
  async function loadMessages() {
    try {
      const data = await api('/api/admin/messages');
      messageRows.innerHTML = data.length ? data.map(m => `
        <tr>
          <td>${escape(m.name)}</td>
          <td>${escape(m.email)}</td>
          <td>${escape(m.subject)}</td>
          <td>${dateStr(m.created_at)}</td>
          <td><span class="status status-${m.status}">${m.status}</span></td>
          <td><button class="linkbtn" data-message="${m.id}">Read Message</button></td>
        </tr>
      `).join('') : '<tr><td colspan="6" class="muted" style="text-align:center; padding:30px;">No inbox messages yet.</td></tr>';

      messageRows.querySelectorAll('[data-message]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const m = data.find(x => String(x.id) === btn.dataset.message);
          modalBody.innerHTML = `
            <p class="eyebrow">INBOX MESSAGE</p>
            <h2>${escape(m.subject)}</h2>
            <p><strong>Sender:</strong> ${escape(m.name)} &lt;${escape(m.email)}&gt;</p>
            <div class="detail" style="white-space:pre-wrap; margin-top:14px;">${escape(m.message)}</div>
            <div class="actions">
              <button class="primary" id="markRead">Mark Read</button>
            </div>
          `;
          modal.hidden = false;
          document.getElementById('markRead').onclick = async () => {
            await api(`/api/admin/messages/${m.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'READ' }) });
            modal.hidden = true;
            loadMessages();
          };
        });
      });
    } catch (err) {
      console.error(err);
    }
  }

  // Settings Loader
  async function loadSettings() {
    try {
      const settings = await api('/api/settings');
      for (const [key, val] of Object.entries(settings)) {
        const input = document.getElementById(`set_${key}`);
        if (input) input.value = val;
      }
    } catch (err) {
      console.error(err);
    }
  }

  document.getElementById('settingsForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const settingsObj = {
      business_name: document.getElementById('set_business_name').value.trim(),
      tagline: document.getElementById('set_tagline').value.trim(),
      phone: document.getElementById('set_phone').value.trim(),
      whatsapp: document.getElementById('set_whatsapp').value.trim(),
      email: document.getElementById('set_email').value.trim(),
      office_hours: document.getElementById('set_office_hours').value.trim(),
      address: document.getElementById('set_address').value.trim(),
      emergency_police: document.getElementById('set_emergency_police').value.trim(),
      emergency_hospital: document.getElementById('set_emergency_hospital').value.trim(),
      emergency_tourism: document.getElementById('set_emergency_tourism').value.trim()
    };

    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settingsObj) });
      alert('Site settings updated successfully!');
    } catch (err) {
      alert(err.message || 'Could not save settings');
    }
  });

  // Audit Logs Loader
  async function loadAuditLogs() {
    try {
      const logs = await api('/api/admin/audit-logs');
      auditRows.innerHTML = logs.length ? logs.map(l => `
        <tr>
          <td>${dateStr(l.created_at)}</td>
          <td>${escape(l.admin_email || 'System')}</td>
          <td><strong>${escape(l.action)}</strong></td>
          <td>${escape(l.entity)} (${escape(l.entity_id)})</td>
          <td><span style="font-size:11px; font-family:monospace;">${escape(l.details)}</span></td>
        </tr>
      `).join('') : '<tr><td colspan="5" class="muted" style="text-align:center; padding:30px;">No audit log records yet.</td></tr>';
    } catch (err) {
      console.error(err);
    }
  }

  checkAuth();
})();
