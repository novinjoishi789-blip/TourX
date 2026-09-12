import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const adminDir = path.join(rootDir, 'admin');

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!jwtSecret) throw new Error('JWT_SECRET is required');

const googleClientId = process.env.GOOGLE_CLIENT_ID || null;
const customerJwtSecret = process.env.CUSTOMER_JWT_SECRET || jwtSecret; // Fallback to jwtSecret if customer secret not explicitly set
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.set('trust proxy', 'loopback');

app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/client', 'https://accounts.google.com'],
      frameSrc: ["'self'", 'https://accounts.google.com/gsi/', 'https://accounts.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style', 'https://accounts.google.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:', 'https://*.googleusercontent.com'],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'", 'https://accounts.google.com/gsi/', 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", 'https://accounts.google.com'],
      frameAncestors: ["'none'"]
    }
  },
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please try again later.' }
});

const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const customerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again later.' }
});

// Utility Functions
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function clean(value, max = 2000) { return String(value || '').trim().slice(0, max); }
function isValidEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function isValidDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function createReference(prefix = 'DH') { return `${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`; }

function normalizePhone(phoneStr) {
  let cleaned = String(phoneStr || '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+91')) return cleaned;
  if (cleaned.startsWith('91') && cleaned.length === 12) return '+' + cleaned;
  if (cleaned.length === 10) return '+91' + cleaned;
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

function isValidPhone(phoneStr) {
  const norm = normalizePhone(phoneStr);
  return /^\+\d{10,13}$/.test(norm);
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Transactional Email Service (Graceful fallback logging when SMTP omitted)
async function sendTransactionalEmail({ to, subject, text, html }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM || 'noreply@dimahasao.com';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(`\n================ TRANSACTIONAL EMAIL LOG ================`);
    console.log(`TO: ${to}`);
    console.log(`FROM: ${fromEmail}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${text || html}`);
    console.log(`===========================================================\n`);
    return { status: 'logged', message: 'SMTP credentials not configured. Email logged to console.' };
  }

  try {
    // Dynamically attempt nodemailer import if available
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: smtpUser, pass: smtpPass }
    });
    await transporter.sendMail({ from: fromEmail, to, subject, text, html });
    return { status: 'sent' };
  } catch (err) {
    console.error('Failed to send transactional email:', err.message);
    return { status: 'error', error: err.message };
  }
}

// Database Initializer
async function ensureSchema() {
  const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = normalizeEmail(process.env.ADMIN_EMAIL);
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await pool.query(`
      INSERT INTO admins (email, password_hash) VALUES ($1, $2)
      ON CONFLICT (email) DO NOTHING
    `, [email, passwordHash]);
  }
}

// Audit Log Helper
async function logAdminAudit(adminId, adminEmail, action, entity, entityId, details) {
  try {
    await pool.query(`
      INSERT INTO admin_audit_logs (admin_id, admin_email, action, entity, entity_id, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [adminId || null, adminEmail || 'admin', action, entity, String(entityId || ''), typeof details === 'object' ? JSON.stringify(details) : String(details || '')]);
  } catch (err) {
    console.error('Failed to record audit log:', err.message);
  }
}

// Status History Helper
async function recordBookingStatusChange(bookingId, previousStatus, newStatus, actor, note) {
  try {
    await pool.query(`
      INSERT INTO booking_status_history (booking_id, previous_status, new_status, actor, note)
      VALUES ($1, $2, $3, $4, $5)
    `, [bookingId, previousStatus || null, newStatus, actor || 'SYSTEM', note || '']);
  } catch (err) {
    console.error('Failed to record status history:', err.message);
  }
}

// Authentication Middlewares
function authRequired(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.admin = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.clearCookie('admin_token');
    return res.status(401).json({ error: 'Session expired' });
  }
}

function customerAuthRequired(req, res, next) {
  const token = req.cookies.customer_token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.customer = jwt.verify(token, customerJwtSecret);
    next();
  } catch {
    res.clearCookie('customer_token');
    return res.status(401).json({ error: 'Session expired' });
  }
}

// Public API Routes

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, status: 'healthy', database: 'connected', version: '2.0.0', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, status: 'degraded', database: 'disconnected', error: err.message });
  }
});

// Site settings
app.get('/api/settings', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM site_settings');
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Could not load site settings' });
  }
});

// Public packages list
app.get('/api/packages', async (req, res) => {
  try {
    const includeInactive = req.query.all === 'true' && req.cookies.admin_token;
    const query = includeInactive
      ? 'SELECT * FROM packages ORDER BY created_at ASC'
      : 'SELECT * FROM packages WHERE active = TRUE ORDER BY featured DESC, created_at ASC';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch packages' });
  }
});

// Public package detail by slug or id
app.get('/api/packages/:slugOrId', async (req, res) => {
  try {
    const param = clean(req.params.slugOrId, 100);
    const { rows } = await pool.query(
      'SELECT * FROM packages WHERE (id = $1 OR slug = $1) AND active = TRUE',
      [param]
    );
    if (!rows.length) return res.status(404).json({ error: 'Package not found' });
    const pkg = rows[0];

    const itinRes = await pool.query(
      'SELECT day_number, title, description FROM package_itineraries WHERE package_id = $1 ORDER BY day_number ASC',
      [pkg.id]
    );
    const incRes = await pool.query(
      'SELECT item, is_inclusion FROM package_inclusions WHERE package_id = $1 ORDER BY id ASC',
      [pkg.id]
    );

    pkg.itinerary = itinRes.rows;
    pkg.inclusions = incRes.rows.filter(r => r.is_inclusion).map(r => r.item);
    pkg.exclusions = incRes.rows.filter(r => !r.is_inclusion).map(r => r.item);

    res.json(pkg);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch package details' });
  }
});

// Create booking request
app.post('/api/bookings', bookingLimiter, async (req, res) => {
  const customerName = clean(req.body.customerName, 120);
  const rawPhone = clean(req.body.phone, 40);
  const phone = normalizePhone(rawPhone);
  const email = normalizeEmail(req.body.email);
  const packageId = clean(req.body.packageId, 40);
  const startDate = clean(req.body.startDate, 10);
  const travelers = Number(req.body.travelers);
  const notes = clean(req.body.notes, 2000);

  let customerId = null;
  const custToken = req.cookies.customer_token;
  if (custToken) {
    try { customerId = jwt.verify(custToken, customerJwtSecret).sub; } catch { customerId = null; }
  }

  if (!customerName || !phone || !email || !packageId || !startDate || !Number.isInteger(travelers)) {
    return res.status(400).json({ error: 'All required booking fields must be provided.' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address.' });
  if (!isValidPhone(phone)) return res.status(400).json({ error: 'Invalid phone number format.' });
  if (!isValidDate(startDate)) return res.status(400).json({ error: 'Invalid start date format.' });
  if (travelers < 1 || travelers > 20) return res.status(400).json({ error: 'Travelers must be between 1 and 20.' });

  // Enforce minimum 2-day advance booking notice
  const minNoticeDays = Number(process.env.MIN_BOOKING_NOTICE_DAYS || 2);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minAllowedDate = new Date(today.getTime() + minNoticeDays * 24 * 60 * 60 * 1000);
  const bookingDate = new Date(`${startDate}T00:00:00Z`);

  if (bookingDate < minAllowedDate) {
    return res.status(400).json({
      error: `Bookings must be requested at least ${minNoticeDays} days in advance of departure.`
    });
  }

  const pkgResult = await pool.query('SELECT id, name, price_per_person, max_travelers FROM packages WHERE id = $1 AND active = TRUE', [packageId]);
  if (!pkgResult.rowCount) return res.status(400).json({ error: 'Selected package is currently not available.' });
  const pkg = pkgResult.rows[0];

  if (travelers > (pkg.max_travelers || 20)) {
    return res.status(400).json({ error: `Maximum group size for this package is ${pkg.max_travelers} travelers.` });
  }

  const totalAmount = pkg.price_per_person * travelers;
  let reference = createReference('DH');

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await pool.query(`
        INSERT INTO bookings (
          booking_reference, customer_name, phone, email, package_id, package_name,
          start_date, travelers, price_per_person, total_amount, notes, customer_id, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PENDING')
        RETURNING id, booking_reference, status, created_at
      `, [reference, customerName, phone, email, pkg.id, pkg.name, startDate, travelers, pkg.price_per_person, totalAmount, notes, customerId]);

      const newBooking = result.rows[0];
      await recordBookingStatusChange(newBooking.id, null, 'PENDING', 'CUSTOMER', 'Initial booking request submitted.');

      // Send transactional confirmation emails asynchronously
      sendTransactionalEmail({
        to: email,
        subject: `Booking Request Received — ${reference}`,
        text: `Hello ${customerName},\n\nThank you for requesting a trip to Dima Hasao!\n\nBooking Reference: ${reference}\nPackage: ${pkg.name}\nStart Date: ${startDate}\nTravelers: ${travelers}\nTotal Amount: ₹${totalAmount.toLocaleString('en-IN')}\nStatus: PENDING OPERATOR CONFIRMATION\n\nWe will review your request and confirm availability within 24 hours.\n\nWarm regards,\nExplore Dima Hasao Tourism`
      });

      if (process.env.ADMIN_EMAIL) {
        sendTransactionalEmail({
          to: process.env.ADMIN_EMAIL,
          subject: `NEW BOOKING REQUEST: ${reference} (${pkg.name})`,
          text: `New booking request received!\nReference: ${reference}\nCustomer: ${customerName} (${phone}, ${email})\nPackage: ${pkg.name}\nDate: ${startDate} | Travelers: ${travelers}\nTotal: ₹${totalAmount.toLocaleString('en-IN')}`
        });
      }

      return res.status(201).json({
        message: 'Booking request received.',
        booking: { ...newBooking, packageName: pkg.name, totalAmount, startDate, travelers, customerName, phone, email }
      });
    } catch (error) {
      if (error.code === '23505') { reference = createReference('DH'); continue; }
      console.error('Booking save error:', error);
      return res.status(500).json({ error: 'Could not save booking request.' });
    }
  }
  return res.status(500).json({ error: 'Could not generate unique booking reference.' });
});

// Guest Booking Claim (Associate guest booking with logged-in Google customer)
app.post('/api/bookings/claim', customerAuthRequired, async (req, res) => {
  const reference = clean(req.body.reference, 40).toUpperCase();
  const email = normalizeEmail(req.body.email);

  if (!reference || !email) {
    return res.status(400).json({ error: 'Booking reference and email address are required.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE booking_reference = $1 AND LOWER(email) = $2', [reference, email]);
    if (!rows.length) return res.status(404).json({ error: 'No matching booking found for this reference and email.' });

    const booking = rows[0];
    if (booking.customer_id && String(booking.customer_id) !== String(req.customer.sub)) {
      return res.status(403).json({ error: 'This booking is already linked to another account.' });
    }

    await pool.query('UPDATE bookings SET customer_id = $1, updated_at = NOW() WHERE id = $2', [req.customer.sub, booking.id]);
    res.json({ ok: true, message: 'Booking successfully linked to your account!', bookingReference: reference });
  } catch (err) {
    res.status(500).json({ error: 'Could not link booking.' });
  }
});

// Submit Contact Message
app.post('/api/messages', messageLimiter, async (req, res) => {
  const name = clean(req.body.name, 120);
  const email = normalizeEmail(req.body.email);
  const subject = clean(req.body.subject, 200);
  const message = clean(req.body.message, 5000);

  if (!name || !email || !subject || !message) return res.status(400).json({ error: 'All message fields are required.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address.' });

  try {
    const { rows } = await pool.query(`
      INSERT INTO messages (name, email, subject, message) VALUES ($1,$2,$3,$4)
      RETURNING id, created_at
    `, [name, email, subject, message]);
    res.status(201).json({ message: 'Message received. We will reply shortly.', id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Could not save message.' });
  }
});

// Submit Custom Trip Request ("Build My Trip")
app.post('/api/custom-trips', bookingLimiter, async (req, res) => {
  const customerName = clean(req.body.customerName, 120);
  const email = normalizeEmail(req.body.email);
  const phone = normalizePhone(clean(req.body.phone, 40));
  const travelDates = clean(req.body.travelDates, 100);
  const travelers = Number(req.body.travelers || 1);
  const budget = clean(req.body.budget, 100);
  const interests = clean(req.body.interests, 300);
  const trekkingPref = clean(req.body.trekkingPref, 100);
  const accommodationPref = clean(req.body.accommodationPref, 100);
  const destinations = clean(req.body.destinations, 300);
  const specialReqs = clean(req.body.specialReqs, 1000);

  if (!customerName || !email || !phone || !travelDates) {
    return res.status(400).json({ error: 'Name, email, phone, and travel dates are required.' });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email address.' });

  const reference = createReference('CT');
  try {
    const { rows } = await pool.query(`
      INSERT INTO custom_trip_requests (
        reference, customer_name, email, phone, travel_dates, travelers, budget,
        interests, trekking_pref, accommodation_pref, destinations, special_reqs
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id, reference, created_at
    `, [reference, customerName, email, phone, travelDates, travelers, budget, interests, trekkingPref, accommodationPref, destinations, specialReqs]);

    res.status(201).json({
      ok: true,
      message: 'Custom trip request submitted! Our travel specialists will craft an itinerary for you.',
      reference: rows[0].reference
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not submit custom trip request.' });
  }
});

// Google Customer Auth Routes
app.get('/api/auth/config', (_req, res) => {
  res.json({ googleClientId });
});

app.post('/api/auth/google', customerLoginLimiter, async (req, res) => {
  if (!googleClient || !customerJwtSecret) return res.status(503).json({ error: 'Google sign-in is not configured on server.' });
  const credential = String(req.body.credential || req.body.g_id_onload || '');
  if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('Google token verification error:', err.message);
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      return res.redirect('/my-bookings.html?auth_error=invalid_token');
    }
    return res.status(401).json({ error: 'Invalid Google credential.' });
  }
  if (!payload?.sub || !payload?.email) {
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      return res.redirect('/my-bookings.html?auth_error=invalid_payload');
    }
    return res.status(401).json({ error: 'Invalid Google credential payload.' });
  }

  const googleSub = payload.sub;
  const email = normalizeEmail(payload.email);
  const name = clean(payload.name || email, 200);
  const pictureUrl = payload.picture ? clean(payload.picture, 500) : null;

  try {
    const { rows } = await pool.query(`
      INSERT INTO customers (google_sub, email, name, picture_url, last_login_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (google_sub) DO UPDATE SET
        email = EXCLUDED.email, name = EXCLUDED.name, picture_url = EXCLUDED.picture_url, last_login_at = NOW()
      RETURNING id, email, name, picture_url
    `, [googleSub, email, name, pictureUrl]);
    const customer = rows[0];

    // Link any existing guest bookings with matching verified email automatically
    await pool.query('UPDATE bookings SET customer_id = $1 WHERE customer_id IS NULL AND LOWER(email) = $2', [customer.id, email]);

    const token = jwt.sign({ sub: customer.id, email: customer.email }, customerJwtSecret, { expiresIn: '30d' });
    res.cookie('customer_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    const isFormSubmit = req.headers['content-type']?.includes('application/x-www-form-urlencoded') ||
                         req.headers['accept']?.includes('text/html');

    if (isFormSubmit) {
      return res.redirect('/my-bookings.html');
    }

    res.json({ ok: true, customer: { id: customer.id, email: customer.email, name: customer.name, pictureUrl: customer.picture_url } });
  } catch (err) {
    console.error('Customer Google auth error:', err);
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      return res.redirect('/my-bookings.html?auth_error=server_error');
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('customer_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', customerAuthRequired, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, email, name, picture_url FROM customers WHERE id = $1', [req.customer.sub]);
    if (!rows.length) return res.status(401).json({ error: 'Customer not found.' });
    res.json({ authenticated: true, customer: rows[0] });
  } catch {
    res.status(401).json({ error: 'Authentication required' });
  }
});

app.get('/api/my/bookings', customerAuthRequired, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC', [req.customer.sub]);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Could not fetch customer bookings.' });
  }
});

// Admin Auth Routes
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const { rows } = await pool.query('SELECT id, email, password_hash FROM admins WHERE email = $1', [email]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    const token = jwt.sign({ sub: admin.id, email: admin.email }, jwtSecret, { expiresIn: '12h' });
    res.cookie('admin_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 60 * 60 * 1000
    });
    await logAdminAudit(admin.id, admin.email, 'LOGIN', 'ADMIN', admin.id, 'Admin logged in.');
    res.json({ ok: true, admin: { id: admin.id, email: admin.email } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

app.get('/api/admin/me', authRequired, (req, res) => res.json({ authenticated: true, admin: req.admin }));

// Admin Management APIs

// Dashboard Statistics
app.get('/api/admin/stats', authRequired, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE status='CONFIRMED')::int AS confirmed,
        COUNT(*) FILTER (WHERE status='CANCELLED')::int AS cancelled,
        COUNT(*) FILTER (WHERE status='COMPLETED')::int AS completed
      FROM bookings
    `);
    const messageResult = await pool.query("SELECT COUNT(*)::int AS unread FROM messages WHERE status='UNREAD'");
    const customResult = await pool.query("SELECT COUNT(*)::int AS pending_custom FROM custom_trip_requests WHERE status='PENDING'");
    res.json({
      ...rows[0],
      unreadMessages: messageResult.rows[0].unread,
      pendingCustomTrips: customResult.rows[0].pending_custom
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch dashboard metrics' });
  }
});

// Admin Search & Filter Bookings
app.get('/api/admin/bookings', authRequired, async (req, res) => {
  try {
    const status = String(req.query.status || 'ALL').toUpperCase();
    const queryStr = clean(req.query.q || '', 100).toLowerCase();

    let sql = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (status !== 'ALL') {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    if (queryStr) {
      params.push(`%${queryStr}%`);
      sql += ` AND (
        LOWER(booking_reference) LIKE $${params.length} OR
        LOWER(customer_name) LIKE $${params.length} OR
        LOWER(email) LIKE $${params.length} OR
        LOWER(phone) LIKE $${params.length} OR
        LOWER(package_name) LIKE $${params.length}
      )`;
    }

    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch bookings list' });
  }
});

// Admin Get Single Booking + Status History
app.get('/api/admin/bookings/:id', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found.' });
    const booking = rows[0];

    const historyRes = await pool.query(
      'SELECT previous_status, new_status, actor, note, created_at FROM booking_status_history WHERE booking_id = $1 ORDER BY created_at DESC',
      [booking.id]
    );
    booking.history = historyRes.rows;

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch booking details' });
  }
});

// Admin Update Booking Status
app.patch('/api/admin/bookings/:id/status', authRequired, async (req, res) => {
  const newStatus = String(req.body.status || '').toUpperCase();
  const note = clean(req.body.note || '', 500);

  if (!['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid booking status.' });
  }

  try {
    const currentRes = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (!currentRes.rows.length) return res.status(404).json({ error: 'Booking not found.' });
    const booking = currentRes.rows[0];

    const { rows } = await pool.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newStatus, req.params.id]
    );
    const updated = rows[0];

    await recordBookingStatusChange(booking.id, booking.status, newStatus, `ADMIN:${req.admin.email}`, note);
    await logAdminAudit(req.admin.sub, req.admin.email, 'UPDATE_STATUS', 'BOOKING', booking.id, { from: booking.status, to: newStatus, note });

    // Send customer notification email upon status change
    if (booking.status !== newStatus) {
      sendTransactionalEmail({
        to: booking.email,
        subject: `Booking Status Update — ${booking.booking_reference}`,
        text: `Hello ${booking.customer_name},\n\nYour booking request (${booking.booking_reference}) status has been updated to: ${newStatus}.\n\nPackage: ${booking.package_name}\nDeparture Date: ${booking.start_date.toISOString().slice(0,10)}\n${note ? `Operator Note: ${note}\n` : ''}\nIf you have any questions, feel free to contact us via WhatsApp or reply to this email.\n\nWarm regards,\nExplore Dima Hasao Tourism`
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Could not update booking status' });
  }
});

// Admin Update Booking Internal Notes
app.patch('/api/admin/bookings/:id/notes', authRequired, async (req, res) => {
  const notes = clean(req.body.notes, 2000);
  try {
    const { rows } = await pool.query('UPDATE bookings SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [notes, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found.' });
    await logAdminAudit(req.admin.sub, req.admin.email, 'UPDATE_NOTES', 'BOOKING', req.params.id, { notes });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not update notes' });
  }
});

// Admin Package CRUD

// Create Package
app.post('/api/admin/packages', authRequired, async (req, res) => {
  const name = clean(req.body.name, 120);
  const price = Number(req.body.price_per_person);
  const duration = clean(req.body.duration, 40);
  const durationDays = Number(req.body.duration_days || 1);
  const durationNights = Number(req.body.duration_nights || 0);
  const shortDescription = clean(req.body.short_description, 500);
  const description = clean(req.body.description, 4000);
  const difficulty = clean(req.body.difficulty, 50);
  const bestSeason = clean(req.body.best_season, 100);
  const meetingPoint = clean(req.body.meeting_point, 200);
  const maxTravelers = Number(req.body.max_travelers || 12);
  const featured = Boolean(req.body.featured);
  const image = clean(req.body.image, 500);

  if (!name || isNaN(price) || price < 0 || !duration) {
    return res.status(400).json({ error: 'Package name, valid price, and duration are required.' });
  }

  const id = slugify(name) || `pkg-${Date.now()}`;
  const slug = slugify(req.body.slug || name);

  try {
    const { rows } = await pool.query(`
      INSERT INTO packages (
        id, name, slug, price_per_person, duration, duration_days, duration_nights,
        short_description, description, difficulty, best_season, meeting_point,
        max_travelers, featured, image, active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE)
      RETURNING *
    `, [id, name, slug, price, duration, durationDays, durationNights, shortDescription, description, difficulty, bestSeason, meetingPoint, maxTravelers, featured, image]);

    await logAdminAudit(req.admin.sub, req.admin.email, 'CREATE', 'PACKAGE', id, { name, price });
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not create package. Ensure name/slug is unique.' });
  }
});

// Update Package Details, Itinerary, and Inclusions
app.put('/api/admin/packages/:id', authRequired, async (req, res) => {
  const pkgId = req.params.id;
  const name = clean(req.body.name, 120);
  const price = Number(req.body.price_per_person);
  const duration = clean(req.body.duration, 40);
  const durationDays = Number(req.body.duration_days || 1);
  const durationNights = Number(req.body.duration_nights || 0);
  const shortDescription = clean(req.body.short_description, 500);
  const description = clean(req.body.description, 4000);
  const difficulty = clean(req.body.difficulty, 50);
  const bestSeason = clean(req.body.best_season, 100);
  const meetingPoint = clean(req.body.meeting_point, 200);
  const maxTravelers = Number(req.body.max_travelers || 12);
  const featured = Boolean(req.body.featured);
  const active = Boolean(req.body.active ?? true);
  const image = clean(req.body.image, 500);
  const slug = slugify(req.body.slug || name);

  try {
    const { rows } = await pool.query(`
      UPDATE packages SET
        name=$1, slug=$2, price_per_person=$3, duration=$4, duration_days=$5, duration_nights=$6,
        short_description=$7, description=$8, difficulty=$9, best_season=$10, meeting_point=$11,
        max_travelers=$12, featured=$13, active=$14, image=$15, updated_at=NOW()
      WHERE id=$16 RETURNING *
    `, [name, slug, price, duration, durationDays, durationNights, shortDescription, description, difficulty, bestSeason, meetingPoint, maxTravelers, featured, active, image, pkgId]);

    if (!rows.length) return res.status(404).json({ error: 'Package not found' });

    // Update Itineraries if provided
    if (Array.isArray(req.body.itinerary)) {
      await pool.query('DELETE FROM package_itineraries WHERE package_id = $1', [pkgId]);
      for (const item of req.body.itinerary) {
        if (item.title && item.description) {
          await pool.query(
            'INSERT INTO package_itineraries (package_id, day_number, title, description) VALUES ($1,$2,$3,$4)',
            [pkgId, Number(item.day_number || 1), clean(item.title, 200), clean(item.description, 2000)]
          );
        }
      }
    }

    // Update Inclusions/Exclusions if provided
    if (Array.isArray(req.body.inclusions) || Array.isArray(req.body.exclusions)) {
      await pool.query('DELETE FROM package_inclusions WHERE package_id = $1', [pkgId]);
      if (Array.isArray(req.body.inclusions)) {
        for (const item of req.body.inclusions) {
          if (clean(item)) {
            await pool.query(
              'INSERT INTO package_inclusions (package_id, item, is_inclusion) VALUES ($1,$2,TRUE)',
              [pkgId, clean(item, 200)]
            );
          }
        }
      }
      if (Array.isArray(req.body.exclusions)) {
        for (const item of req.body.exclusions) {
          if (clean(item)) {
            await pool.query(
              'INSERT INTO package_inclusions (package_id, item, is_inclusion) VALUES ($1,$2,FALSE)',
              [pkgId, clean(item, 200)]
            );
          }
        }
      }
    }

    await logAdminAudit(req.admin.sub, req.admin.email, 'UPDATE', 'PACKAGE', pkgId, { name, price, active });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not update package.' });
  }
});

// Toggle Package Active Status (Safe Deactivation/Archive)
app.patch('/api/admin/packages/:id/active', authRequired, async (req, res) => {
  const active = Boolean(req.body.active);
  try {
    const { rows } = await pool.query('UPDATE packages SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [active, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Package not found' });
    await logAdminAudit(req.admin.sub, req.admin.email, 'TOGGLE_ACTIVE', 'PACKAGE', req.params.id, { active });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not toggle package status' });
  }
});

// Soft-Delete/Archive Package
app.delete('/api/admin/packages/:id', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query('UPDATE packages SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Package not found' });
    await logAdminAudit(req.admin.sub, req.admin.email, 'ARCHIVE', 'PACKAGE', req.params.id, 'Soft deleted package.');
    res.json({ ok: true, message: 'Package archived safely.', package: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Could not archive package' });
  }
});

// Custom Trip Requests Management
app.get('/api/admin/custom-trips', authRequired, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM custom_trip_requests ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch custom trip requests' });
  }
});

app.patch('/api/admin/custom-trips/:id/status', authRequired, async (req, res) => {
  const status = clean(req.body.status, 20).toUpperCase();
  if (!['PENDING', 'REVIEWED', 'CONTACTED', 'ARCHIVED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  try {
    const { rows } = await pool.query('UPDATE custom_trip_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Custom trip request not found.' });
    await logAdminAudit(req.admin.sub, req.admin.email, 'UPDATE_STATUS', 'CUSTOM_TRIP', req.params.id, { status });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not update custom trip request status' });
  }
});

// Site Settings Management
app.put('/api/admin/settings', authRequired, async (req, res) => {
  const settingsObj = req.body;
  if (!settingsObj || typeof settingsObj !== 'object') {
    return res.status(400).json({ error: 'Invalid settings object' });
  }
  try {
    for (const [key, value] of Object.entries(settingsObj)) {
      await pool.query(
        'INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [clean(key, 100), clean(value, 2000)]
      );
    }
    await logAdminAudit(req.admin.sub, req.admin.email, 'UPDATE', 'SITE_SETTINGS', 'global', settingsObj);
    res.json({ ok: true, message: 'Settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not save site settings' });
  }
});

// Audit Logs View
app.get('/api/admin/audit-logs', authRequired, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch audit logs' });
  }
});

// Messages Management
app.get('/api/admin/messages', authRequired, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch messages' });
  }
});

app.patch('/api/admin/messages/:id/status', authRequired, async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['UNREAD', 'READ', 'ARCHIVED'].includes(status)) return res.status(400).json({ error: 'Invalid message status.' });
  try {
    const { rows } = await pool.query('UPDATE messages SET status=$1 WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Message not found.' });
    await logAdminAudit(req.admin.sub, req.admin.email, 'UPDATE_STATUS', 'MESSAGE', req.params.id, { status });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Could not update message status' });
  }
});

// Static Assets & Web Serving
app.use('/admin', express.static(adminDir));
app.get('/admin/*splat', (_req, res) => res.sendFile(path.join(adminDir, 'index.html')));
app.use(express.static(publicDir, { extensions: ['html'] }));

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

const host = '127.0.0.1';
ensureSchema()
  .then(() => app.listen(port, host, () => console.log(`Dima Hasao Tourism platform server running at http://${host}:${port}`)))
  .catch(error => { console.error('Startup failed:', error); process.exit(1); });
