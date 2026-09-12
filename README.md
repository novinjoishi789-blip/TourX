# Dima Hasao Tourism Platform — Production Launch Architecture

A production-ready local tourism business platform for **Dima Hasao / Haflong, Assam, India**. Built with Node.js, Express, PostgreSQL, and Google Identity Services.

---

## 🌟 Key Platform Features

- **Authoritative Database Source of Truth**: Package pricing, itineraries, inclusions, bookings, customer accounts, and site settings driven entirely by PostgreSQL.
- **Asynchronous Google Sign-In & Auth**: Robust client-side GIS script initialization with fallback retry polling, customer JWT sessions in Secure/HttpOnly cookies, and account linking.
- **Dynamic Package Catalog & Search**: Multi-filter by duration (weekend/multi-day/extended), budget range, difficulty, and season.
- **Structured Package Details**: Dedicated detail pages (`package-detail.html?slug=...`) with day-by-day itineraries, inclusions vs. exclusions lists, meeting points, safety notes, and prefilled WhatsApp inquiry links.
- **Booking Request Workflow & Dedicated Success Page**: Strict backend validation (2-day advance notice rule, phone normalization, traveler limits), unique reference generation (`DH-2026-XXXXXX`), and dedicated success page (`booking-success.html`).
- **Guest + Google Booking Claim System**: Guests can book without signing in and later claim/link their booking to their Google account using their booking reference + email address.
- **Custom Trip Requests ("Build My Trip")**: Interactive form for custom itineraries, budgets, and trekking preferences.
- **Multi-Tab Operator Admin Dashboard**:
  - **Bookings Management**: Search by reference/name/phone/email, status filtering, booking lifecycle audit history timeline, internal notes, and direct WhatsApp/Call links.
  - **Package Catalog CRUD**: Full visual editor to create, edit, activate/deactivate, and soft-delete/archive packages and itineraries.
  - **Custom Trips Management**: Review and track custom trip inquiries.
  - **Inbox Messages**: Manage contact form inquiries.
  - **Site Settings Manager**: Edit business phone, WhatsApp, email, office hours, and emergency helplines.
  - **Security Audit Logs**: Track all administrative actions.
- **Transactional Email Service**: Automated customer & operator notifications with fallback console logging if SMTP parameters are omitted.
- **SEO & Legal Policies**: Full meta tags, OpenGraph, JSON-LD structured data, `sitemap.xml`, `robots.txt`, Privacy Policy, Terms & Conditions, Cancellation & Refund Policy, and Responsible Tourism guide.

---

## 🛠️ Architecture Overview

```
Frontend (HTML / CSS / JS / GIS)
  ↓
Express Server (Node.js REST API & Static Middleware)
  ↓
PostgreSQL Database (Tables: packages, package_itineraries, package_inclusions, bookings, booking_status_history, customers, custom_trip_requests, site_settings, admin_audit_logs)
  ↓
Operator Admin Dashboard (/admin)
```

---

## 🚀 Running Locally

1. **Start PostgreSQL**:
   ```bash
   docker compose up -d
   ```

2. **Configure Environment Variables**:
   ```powershell
   cd server
   copy .env.example .env
   ```

3. **Install Server Dependencies**:
   ```powershell
   npm install
   ```

4. **Launch Server**:
   ```powershell
   npm run dev
   ```

5. **Access Points**:
   - Public Platform: `http://localhost:3000`
   - Package Catalog: `http://localhost:3000/packages.html`
   - Booking Request: `http://localhost:3000/booking.html`
   - Customer Portal: `http://localhost:3000/my-bookings.html`
   - Operator Admin Portal: `http://localhost:3000/admin`
   - Health Check: `http://localhost:3000/api/health`

---

## 🔐 Security Standards Enforced

- **Security Headers**: Helmet CSP configured for Google Identity Services scripts and Google Fonts.
- **Rate Limiting**: Tiered limiters on login, booking creation, contact submission, and customer auth.
- **Input Sanitization & Normalization**: Server-side string cleaning, strict regex validations, and Indian phone number format normalization (`+918099774793`).
- **Audit Logging**: Every admin action recorded with timestamp, admin email, entity ID, and metadata.
- **Protected Environment**: Secrets kept out of git tracking (`.gitignore` enforces `.env` exclusion).
