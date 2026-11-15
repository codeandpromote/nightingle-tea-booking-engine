-- Nightingale Tea Tourism Official Estates & Tariff Seed Data

INSERT INTO estates (
    slug, name, subtitle, location, distance_from_airport, nearest_station,
    accommodation_type, total_rooms, max_adults_per_room, max_children_per_room,
    map_base_rate, all_meals_base_rate, extra_adult_map_rate, extra_adult_all_meals_rate,
    child_5_12_map_rate, child_5_12_all_meals_rate, amenities_json, nearby_json, image_path, is_active
) VALUES
(
    'mateli',
    'Mateli Tea Estate',
    'Heritage Planter Bungalow',
    'Matelli, Dooars, West Bengal',
    '90 km from Bagdogra Airport',
    'Chalsa Junction',
    'Colonial Bungalow Suites',
    6, 3, 2,
    10000, 12000, 3500, 5000, 3500, 2000,
    JSON_ARRAY('Guided Tea Factory Visit', 'Curated Tea Tasting', 'Veranda Dining', 'Power Backup & Hot Water', 'Estate Concierge'),
    JSON_ARRAY('Chapramari Wildlife Sanctuary', 'Gorumara National Park', 'Samsing & Suntalekhola', 'Jhalong & Bindu'),
    'assets/images/estate_mateli.jpg',
    1
),
(
    'jainti',
    'Jainti Tea Estate',
    'Hill-View Bungalow & Cottages',
    'Jayanti / Chuniajhora, Dooars, West Bengal',
    '220 km from Bagdogra Airport',
    'Alipurduar Junction',
    'Hill-View Suites & Cottages',
    6, 3, 2,
    10000, 12000, 3500, 5000, 3500, 2000,
    JSON_ARRAY('Bhutan Foothills Panorama', 'Guided Factory Tour', 'Tea Tasting Session', 'Room Heaters & Hot Water', 'Birding Trails'),
    JSON_ARRAY('Buxa Tiger Reserve & Fort', 'Jayanti Riverbed', 'Mahakal Cave', 'Rover''s Point & Pokhri Hill'),
    'assets/images/estate_jainti.jpg',
    1
),
(
    'chuapara',
    'Chuapara Tea Estate',
    'Executive Plantation Cottages',
    'Chuapara, Dooars, West Bengal',
    '170 km from Bagdogra / NJP',
    'Hamiltonganj & Kalchini (7 km)',
    'Executive Multi-Room Cottages',
    8, 3, 2,
    8000, 10000, 2500, 3000, 2000, 1500,
    JSON_ARRAY('Private Sit-Out Porch', 'Attached Dining Veranda', 'Tea Garden Walks', 'Power Backup & Hot Water', 'Dedicated Estate Staff'),
    JSON_ARRAY('Buxa Tiger Reserve', 'Chilapata Forest', 'Bhutan Border (Jaigaon)', 'Dukpa Tribal Settlement'),
    'assets/images/estate_chuapara.jpg',
    1
)
ON DUPLICATE KEY UPDATE
    total_rooms = VALUES(total_rooms),
    map_base_rate = VALUES(map_base_rate),
    all_meals_base_rate = VALUES(all_meals_base_rate),
    extra_adult_map_rate = VALUES(extra_adult_map_rate),
    extra_adult_all_meals_rate = VALUES(extra_adult_all_meals_rate),
    child_5_12_map_rate = VALUES(child_5_12_map_rate),
    child_5_12_all_meals_rate = VALUES(child_5_12_all_meals_rate);

-- Seed multiple room categories & unit numbers across Mateli (6), Jainti (6), and Chuapara (8)
INSERT INTO estate_room_types (estate_id, slug, name, bed_type, unit_labels_json, total_units, map_rate, all_meals_rate, is_active) VALUES
((SELECT id FROM estates WHERE slug = 'mateli'), 'rm-mat-suite', 'Burra Sahib Heritage Suite', 'King Four-Poster · Private Veranda', JSON_ARRAY('M-101', 'M-102'), 2, 10000, 12000, 1),
((SELECT id FROM estates WHERE slug = 'mateli'), 'rm-mat-deluxe', 'Garden Veranda Deluxe Room', 'Queen Bed · Tea Lawn View', JSON_ARRAY('M-103', 'M-104'), 2, 10000, 12000, 1),
((SELECT id FROM estates WHERE slug = 'mateli'), 'rm-mat-cottage', 'Planter''s Tea-View Room', 'King / Twin · Factory Trail Access', JSON_ARRAY('M-105', 'M-106'), 2, 10000, 12000, 1),
((SELECT id FROM estates WHERE slug = 'jainti'), 'rm-jai-suite', 'Bhutan Foothills Hill-View Suite', 'King Bed · Foothills Viewing Deck', JSON_ARRAY('J-201', 'J-202'), 2, 10000, 12000, 1),
((SELECT id FROM estates WHERE slug = 'jainti'), 'rm-jai-cottage', 'Buxa Forest Timber Cottage', 'King Bed · Forest Sit-Out', JSON_ARRAY('J-203', 'J-204'), 2, 10000, 12000, 1),
((SELECT id FROM estates WHERE slug = 'jainti'), 'rm-jai-river', 'Chuniajhora Riverfront Room', 'Double Bed · Hill Breeze Porch', JSON_ARRAY('J-205', 'J-206'), 2, 10000, 12000, 1),
((SELECT id FROM estates WHERE slug = 'chuapara'), 'rm-chu-exec', 'Executive Plantation Cottage', 'King Bed · Private Sit-Out', JSON_ARRAY('C-301', 'C-302', 'C-303'), 3, 8000, 10000, 1),
((SELECT id FROM estates WHERE slug = 'chuapara'), 'rm-chu-family', 'Duplex Family Tea Cottage', 'Twin / King · Dining Porch', JSON_ARRAY('C-304', 'C-305', 'C-306'), 3, 8000, 10000, 1),
((SELECT id FROM estates WHERE slug = 'chuapara'), 'rm-chu-orchid', 'Orchid Lawn Standard Room', 'Queen Bed · Garden Courtyard', JSON_ARRAY('C-307', 'C-308'), 2, 8000, 10000, 1)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    bed_type = VALUES(bed_type),
    unit_labels_json = VALUES(unit_labels_json),
    total_units = VALUES(total_units),
    map_rate = VALUES(map_rate),
    all_meals_rate = VALUES(all_meals_rate);

INSERT INTO settings (setting_key, setting_value) VALUES
('brand_name', 'Nightingale Tea Tourism'),
('primary_domain', 'https://nightingaletea.com'),
('upi_id', 'nightingaletea@icici'),
('upi_merchant_name', 'Nightingale Tea Tourism'),
('hold_ttl_minutes', '30'),
('gst_percentage', '0'),
('razorpay_enabled', '1'),
('manual_upi_enabled', '1'),
('support_phone', '+91 95839 36626'),
('support_email', 'sales@nightingaletea.in')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Default Admin user (Password: Nightingale@2026 - change immediately on first login!)
INSERT INTO admin_users (username, full_name, email, password_hash, role) VALUES
('admin', 'Nightingale Estate Director', 'sales@nightingaletea.in', '$2y$12$KIXxJ7m7g0Z5e6Q4k3R2Xe5a0R1Z2c8yQ9vW3tN6mB7pL8sK4jF1i', 'SUPER_ADMIN')
ON DUPLICATE KEY UPDATE username = VALUES(username);
