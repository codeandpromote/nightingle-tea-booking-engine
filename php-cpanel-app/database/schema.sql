-- Nightingale Tea Tourism Booking Management System
-- Enterprise InnoDB Schema tuned for Shared cPanel MySQL 8.0 / MariaDB 10.6+

SET NAMES utf8mb4;
SET time_zone = '+05:30';

CREATE TABLE IF NOT EXISTS estates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    subtitle VARCHAR(150) NOT NULL,
    location VARCHAR(200) NOT NULL,
    distance_from_airport VARCHAR(120) NOT NULL,
    nearest_station VARCHAR(120) NOT NULL,
    accommodation_type VARCHAR(120) NOT NULL,
    total_rooms TINYINT UNSIGNED NOT NULL DEFAULT 4,
    max_adults_per_room TINYINT UNSIGNED NOT NULL DEFAULT 3,
    max_children_per_room TINYINT UNSIGNED NOT NULL DEFAULT 2,
    map_base_rate INT UNSIGNED NOT NULL,
    all_meals_base_rate INT UNSIGNED NOT NULL,
    extra_adult_map_rate INT UNSIGNED NOT NULL,
    extra_adult_all_meals_rate INT UNSIGNED NOT NULL,
    child_5_12_map_rate INT UNSIGNED NOT NULL,
    child_5_12_all_meals_rate INT UNSIGNED NOT NULL,
    amenities_json JSON NOT NULL,
    nearby_json JSON NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Room Categories & Unit Inventory per Tea Estate (supports admin dynamic unit allocation)
CREATE TABLE IF NOT EXISTS estate_room_types (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id INT UNSIGNED NOT NULL,
    slug VARCHAR(64) NOT NULL,
    name VARCHAR(150) NOT NULL,
    bed_type VARCHAR(160) NOT NULL DEFAULT '',
    unit_labels_json JSON NOT NULL,
    total_units TINYINT UNSIGNED NOT NULL DEFAULT 2,
    map_rate INT UNSIGNED NOT NULL,
    all_meals_rate INT UNSIGNED NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_estate_room_slug (estate_id, slug),
    KEY idx_room_estate_active (estate_id, is_active),
    CONSTRAINT fk_room_estate FOREIGN KEY (estate_id) REFERENCES estates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Date-level inventory & seasonal rate override ledger (supports SELECT ... FOR UPDATE row locking)
CREATE TABLE IF NOT EXISTS inventory_calendar (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estate_id INT UNSIGNED NOT NULL,
    stay_date DATE NOT NULL,
    is_blocked TINYINT(1) NOT NULL DEFAULT 0,
    block_reason VARCHAR(200) NULL,
    custom_total_rooms TINYINT UNSIGNED NULL,
    min_stay TINYINT UNSIGNED NOT NULL DEFAULT 1,
    map_rate_override INT UNSIGNED NULL,
    all_meals_rate_override INT UNSIGNED NULL,
    updated_by VARCHAR(100) NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_estate_date (estate_id, stay_date),
    KEY idx_inv_date (stay_date),
    CONSTRAINT fk_inv_estate FOREIGN KEY (estate_id) REFERENCES estates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_ref VARCHAR(32) NOT NULL UNIQUE,
    estate_id INT UNSIGNED NOT NULL,
    room_type_id INT UNSIGNED NULL,
    room_type_name VARCHAR(150) NULL,
    room_summary VARCHAR(200) NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights TINYINT UNSIGNED NOT NULL,
    rooms_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
    adults TINYINT UNSIGNED NOT NULL DEFAULT 2,
    children_5_12 TINYINT UNSIGNED NOT NULL DEFAULT 0,
    children_under_5 TINYINT UNSIGNED NOT NULL DEFAULT 0,
    meal_plan ENUM('MAP', 'ALL_MEALS') NOT NULL DEFAULT 'MAP',
    guest_name VARCHAR(150) NOT NULL,
    guest_phone VARCHAR(30) NOT NULL,
    guest_email VARCHAR(160) NOT NULL,
    guest_city VARCHAR(120) NOT NULL DEFAULT '',
    id_proof_type VARCHAR(60) NULL,
    special_requests TEXT NULL,
    base_room_total INT UNSIGNED NOT NULL,
    extra_adult_total INT UNSIGNED NOT NULL DEFAULT 0,
    child_total INT UNSIGNED NOT NULL DEFAULT 0,
    gst_amount INT UNSIGNED NOT NULL DEFAULT 0,
    total_amount INT UNSIGNED NOT NULL,
    payment_method ENUM('RAZORPAY', 'MANUAL_UPI') NOT NULL,
    status ENUM('AWAITING_PAYMENT', 'PENDING_VERIFICATION', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'AWAITING_PAYMENT',
    razorpay_order_id VARCHAR(80) NULL,
    razorpay_payment_id VARCHAR(80) NULL,
    upi_utr VARCHAR(64) NULL,
    upi_proof_file VARCHAR(255) NULL,
    hold_expires_at DATETIME NULL,
    source_channel ENUM('PORTAL', 'MAIN_SITE_LINK', 'ADMIN_MANUAL') NOT NULL DEFAULT 'PORTAL',
    admin_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_booking_estate_dates (estate_id, check_in, check_out),
    KEY idx_booking_room_type (room_type_id, check_in, check_out),
    KEY idx_booking_status_hold (status, hold_expires_at),
    KEY idx_booking_phone (guest_phone),
    KEY idx_booking_checkin (check_in),
    CONSTRAINT fk_booking_estate FOREIGN KEY (estate_id) REFERENCES estates(id) ON DELETE RESTRICT,
    CONSTRAINT fk_booking_room_type FOREIGN KEY (room_type_id) REFERENCES estate_room_types(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-night allocation rows locked inside transactions to prevent double bookings under high concurrency
CREATE TABLE IF NOT EXISTS booking_nights (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNSIGNED NOT NULL,
    estate_id INT UNSIGNED NOT NULL,
    room_type_id INT UNSIGNED NULL,
    stay_date DATE NOT NULL,
    rooms_allocated TINYINT UNSIGNED NOT NULL,
    nightly_rate INT UNSIGNED NOT NULL,
    KEY idx_bn_estate_date (estate_id, stay_date),
    KEY idx_bn_room_date (room_type_id, stay_date),
    CONSTRAINT fk_bn_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_bn_estate FOREIGN KEY (estate_id) REFERENCES estates(id) ON DELETE CASCADE,
    CONSTRAINT fk_bn_room_type FOREIGN KEY (room_type_id) REFERENCES estate_room_types(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNSIGNED NOT NULL,
    method ENUM('RAZORPAY', 'MANUAL_UPI') NOT NULL,
    amount INT UNSIGNED NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    gateway_order_id VARCHAR(100) NULL,
    gateway_payment_id VARCHAR(100) NULL,
    utr_reference VARCHAR(64) NULL,
    proof_filename VARCHAR(255) NULL,
    status ENUM('INITIATED', 'SUBMITTED', 'VERIFIED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'INITIATED',
    verified_by VARCHAR(100) NULL,
    verified_at DATETIME NULL,
    raw_payload_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_pay_booking (booking_id),
    KEY idx_pay_order (gateway_order_id),
    CONSTRAINT fk_pay_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'ESTATE_MANAGER', 'ACCOUNTS_VERIFIER') NOT NULL DEFAULT 'ESTATE_MANAGER',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor VARCHAR(120) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_ref VARCHAR(64) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_target (target_ref),
    KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
