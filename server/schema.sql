CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_per_person INTEGER NOT NULL CHECK (price_per_person >= 0),
  duration TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE packages ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS short_description TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration_nights INTEGER NOT NULL DEFAULT 0;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS max_travelers INTEGER NOT NULL DEFAULT 12;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'Easy';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS best_season TEXT NOT NULL DEFAULT 'October to April';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS meeting_point TEXT NOT NULL DEFAULT 'Haflong Town';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS package_itineraries (
  id BIGSERIAL PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS package_inclusions (
  id BIGSERIAL PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  is_inclusion BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_reference TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  package_id TEXT NOT NULL REFERENCES packages(id),
  package_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  travelers INTEGER NOT NULL CHECK (travelers BETWEEN 1 AND 20),
  price_per_person INTEGER NOT NULL CHECK (price_per_person >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);

CREATE TABLE IF NOT EXISTS booking_status_history (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'SYSTEM',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bsh_booking_id ON booking_status_history(booking_id);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD','READ','ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_trip_requests (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  travel_dates TEXT NOT NULL,
  travelers INTEGER NOT NULL DEFAULT 1,
  budget TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '',
  trekking_pref TEXT NOT NULL DEFAULT '',
  accommodation_pref TEXT NOT NULL DEFAULT '',
  destinations TEXT NOT NULL DEFAULT '',
  special_reqs TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','CONTACTED','ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_date ON bookings(start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- Seed packages with full authentic data if missing or update essential fields
INSERT INTO packages (id, name, slug, price_per_person, duration, duration_days, duration_nights, short_description, description, difficulty, best_season, meeting_point, max_travelers, featured, image) VALUES
('jatinga', 'Jatinga Mystery Weekend', 'jatinga-mystery-weekend', 4500, '2D / 1N', 2, 1, 'A short escape into Jatinga''s fog-wrapped valley, paired with a calm evening boat ride at Haflong Lake. Ideal for a first visit.', 'Experience the mysterious ridge of Jatinga, known worldwide for its legendary mist and migratory bird phenomenon during late monsoon. Includes homestay experience, guided nature trail, and serene Haflong lake evening.', 'Easy', 'September to March', 'Haflong Town Railway Station / Hotel', 10, TRUE, 'assets/images/packages/jatinga-mystery-weekend.jpeg'),
('borail', 'Borail Wilderness Trek', 'borail-wilderness-trek', 7800, '3D / 2N', 3, 2, 'A guided multi-day trek through Borail Wildlife Sanctuary with two nights of ridge camping and a packed wildlife-spotting itinerary.', 'Embark on an immersive wilderness trek across the high ridges of the Borail Range. Hike through primary evergreen rainforests, spot rare flora and endemic bird species, and camp under starry mountain skies with certified local guides.', 'Moderate-Challenging', 'October to April', 'Haflong Market Center', 8, TRUE, 'assets/images/packages/borail-wilderness-trek.webp'),
('sunrise', 'Sunrise & Serenity', 'sunrise-serenity', 5200, '2D / 1N', 2, 1, 'Overnight camp below Tumjang Peak timed for the above-the-clouds sunrise, followed by a slow lakeside morning at Haflong.', 'Hike up the famed Tumjang Peak—often called the Great Wall of Dima Hasao. Sleep overnight at cloud level and wake up to a breathtaking 360-degree golden sunrise above sea-of-clouds before returning to Haflong Lake.', 'Moderate', 'October to May', 'Lower Haflong', 12, TRUE, 'assets/images/packages/sunrise-serenity.jpeg'),
('explorer', 'Complete Dima Hasao Explorer', 'complete-dima-hasao-explorer', 13500, '5D / 4N', 5, 4, 'Every signature destination in one trip — Jatinga, Borail, Tumjang, Haflong, Panimur, and Maibang, at an easy pace.', 'The ultimate Dima Hasao experience. From the roaring waterfalls of Panimur to the ancient Dimasa kingdom ruins at Maibang, peak views at Tumjang, birdwatching at Jatinga, and sunset at Haflong Lake.', 'Moderate', 'October to May', 'Silchar Airport / Haflong Station', 12, TRUE, 'assets/images/packages/complete-explorer.jpeg'),
('heritage', 'Heritage & Culture Trail', 'heritage-culture-trail', 6900, '3D / 2N', 3, 2, 'Maibang''s Dimasa ruins, local craft villages, and traditional cuisine — a slower trip built around history and culture.', 'Step back in time to Maibang, the 16th-century capital of the Dimasa Kingdom. Explore monolithic stone structures, visit traditional village weavers, sample authentic ethnic Dimasa cuisine, and experience warm hill hospitality.', 'Easy', 'Year-round', 'Maibang Railway Station / Haflong', 10, FALSE, 'assets/images/packages/heritage-culture-trail.jpeg'),
('monsoon', 'Monsoon Waterfall Special', 'monsoon-waterfall-special', 4900, '2D / 1N', 2, 1, 'Panimur Waterfall at peak flow, paired with a Jatinga evening — timed each year for the heart of monsoon season.', 'Witness the spectacular Niagara of Assam in full force! Panimur Waterfall roars through turquoise and golden waters during monsoon. Paired with fresh hill showers and local tea garden visits.', 'Easy', 'July to September', 'Haflong Town', 15, FALSE, 'assets/images/packages/monsoon-waterfall-special.jpeg')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  price_per_person = EXCLUDED.price_per_person,
  duration = EXCLUDED.duration,
  duration_days = EXCLUDED.duration_days,
  duration_nights = EXCLUDED.duration_nights,
  short_description = EXCLUDED.short_description,
  description = EXCLUDED.description,
  difficulty = EXCLUDED.difficulty,
  best_season = EXCLUDED.best_season,
  meeting_point = EXCLUDED.meeting_point,
  max_travelers = EXCLUDED.max_travelers,
  featured = EXCLUDED.featured,
  image = EXCLUDED.image,
  updated_at = NOW();

-- Seed sample itineraries for packages
INSERT INTO package_itineraries (package_id, day_number, title, description) VALUES
('jatinga', 1, 'Arrival & Haflong Lake Evening', 'Pick up from Haflong Station/Town. Check-in to local homestay. Afternoon relaxation and evening sunset boat ride on Haflong Lake followed by local hill tea and snacks.'),
('jatinga', 2, 'Jatinga Ridge Walk & Village Heritage', 'Early morning excursion to Jatinga Ridge. Guided nature walk learning about local bird migrations and flora. Visit to local orchid nursery and traditional handicraft center before departure.'),
('borail', 1, 'Base Camp Trek into Borail Forest', 'Meet guide at Haflong Market. Transfer to trek head. 4-hour ascend through tropical evergreen rainforest to Borail base camp. Set up camp and evening campfire.'),
('borail', 2, 'Ridge Ascent & Wildlife Trail', 'Full day trekking along Borail ridge line. High probability of birdwatching and spotting endemic flora. Ridge-top camping under clear stars.'),
('borail', 3, 'Descend & Transfer', 'Morning breakfast at campsite. Scenic descent back to valley. Return transfer to Haflong with unforgettable mountain views.'),
('sunrise', 1, 'Trek to Tumjang Base & Ridge Camp', 'Drive to Tumjang trailhead. 3-hour trek along rolling grassy ridges. Sunset views over the Kopili River valley. Overnight mountain tent camping.'),
('sunrise', 2, 'Cloud-Sea Sunrise & Lake Breakfast', 'Wake up at 5:00 AM for the spectacular above-clouds sunrise. Breakfast at ridge camp. Descend back to Haflong for lakeside relaxation and departure.'),
('explorer', 1, 'Arrival & Haflong Town Exploration', 'Welcome to Haflong. Check in to boutique homestay. Visit Haflong Lake, local Dimasa market, and hilltop view point.'),
('explorer', 2, 'Maibang Royal Ruins & Heritage', 'Excursion to Maibang. Discover Stone House (Ek Pathar Ghar) built into single monolithic rock. Village traditional weaving demonstration.'),
('explorer', 3, 'Panimur Waterfalls Excursion', 'Full day trip to Panimur Waterfalls on Kopili River. Picnic lunch by the cascading rapids and bamboo bridge walk.'),
('explorer', 4, 'Tumjang Peak Hike', 'Day trek up Tumjang Peak. High ridge views, grassy mountain paths, and evening cultural dinner in Haflong.'),
('explorer', 5, 'Jatinga Mist & Departure', 'Morning visit to Jatinga bird watch tower and local organic orange orchards. Souvenir shopping and drop to station.'),
('heritage', 1, 'Historical Maibang Kingdom Tour', 'Transfer to Maibang. Guided tour of 16th century Dimasa capital ruins, Mahur riverbank, and ancient royal temples.'),
('heritage', 2, 'Traditional Village Immersion & Crafts', 'Visit ethnic Dimasa and Zeme Naga villages. Learn traditional handloom weaving and sample authentic smoked meats and bamboo shoot dishes.'),
('heritage', 3, 'Local Market & Departure', 'Morning visit to Haflong ethnic handicraft market. Transfer to station with handmade souvenirs.'),
('monsoon', 1, 'Panimur Cascades in Monsoon', 'Drive to Panimur Waterfalls. Experience roaring Kopili river rapids in full monsoon glory. Riverside stay and evening tea.'),
('monsoon', 2, 'Jatinga Rain Walk & Departure', 'Morning guided walk through rain-soaked forests of Jatinga. Visit to local tea garden before departure.')
ON CONFLICT DO NOTHING;

-- Seed sample inclusions and exclusions
INSERT INTO package_inclusions (package_id, item, is_inclusion) VALUES
('jatinga', 'Homestay accommodation (1 night)', TRUE),
('jatinga', 'All meals (Breakfast, Lunch, Dinner)', TRUE),
('jatinga', 'Experienced local Dimasa guide', TRUE),
('jatinga', 'Haflong Lake boat ride tickets', TRUE),
('jatinga', 'Personal expenses & alcohol', FALSE),
('jatinga', 'Travel insurance', FALSE),

('borail', 'High-quality 2-person tents & sleeping bags', TRUE),
('borail', 'Certified wilderness trek guide & porter', TRUE),
('borail', 'Forest sanctuary entry permits', TRUE),
('borail', 'All trail meals & high-energy snacks', TRUE),
('borail', 'Personal trekking boots & apparel', FALSE),

('sunrise', 'Overnight camping equipment', TRUE),
('sunrise', 'Peak trek guide', TRUE),
('sunrise', 'Campfire dinner & morning breakfast', TRUE),
('sunrise', 'Personal transport to trailhead', FALSE),

('explorer', '4 nights homestay/hotel stays', TRUE),
('explorer', 'Private AC vehicle for all 5 days', TRUE),
('explorer', 'Dedicated district guide & entry fees', TRUE),
('explorer', 'All meals across all 5 days', TRUE),
('explorer', 'Flights/Train tickets to Haflong', FALSE),

('heritage', 'Cultural guide & village entry fees', TRUE),
('heritage', 'Authentic Dimasa ethnic meals', TRUE),
('heritage', 'Local homestay accommodation', TRUE),

('monsoon', 'Waterfall view permits', TRUE),
('monsoon', 'Riverside lodge stay', TRUE),
('monsoon', 'Rain gear rental', TRUE)
ON CONFLICT DO NOTHING;

-- Seed default site settings
INSERT INTO site_settings (key, value) VALUES
('business_name', 'Explore Dima Hasao Tourism'),
('tagline', 'Authentic Small-Group & Custom Journeys in Assam''s Hill District'),
('phone', '+91 8099774793'),
('whatsapp', '+918099774793'),
('email', 'novinjoishi789@gmail.com'),
('address', 'Haflong Town, Dima Hasao District, Assam, India — 788819'),
('office_hours', 'Monday – Saturday: 8:00 AM – 7:00 PM IST'),
('instagram', 'https://www.instagram.com/novin_joishi?igsh=ZmE0dzlleThicmds'),
('facebook', 'https://www.facebook.com/profile.php?id=100063756517577'),
('emergency_police', '112 / +91 3673 236222 (Haflong Police Station)'),
('emergency_hospital', '+91 3673 236233 (Civil Hospital Haflong)'),
('emergency_tourism', '+91 8099774793 (24/7 Dima Hasao Helpline)')
ON CONFLICT (key) DO NOTHING;
