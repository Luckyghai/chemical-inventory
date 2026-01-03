
-- PostgreSQL Schema

-- Drop tables if they exist (Reverse order of dependencies)
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS equipments;
DROP TABLE IF EXISTS chemicals;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS users;

-- Table for Users (Auth)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storage locations
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    room_number VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for the chemicals
CREATE TABLE chemicals (
    id SERIAL PRIMARY KEY,
    cas_number VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    formula VARCHAR(100),
    
    -- Inventory details
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(10) NOT NULL,
    
    -- Foreign Key to Location
    location_id INT,
    
    -- Safety & Meta
    expiry_date DATE,
    safety_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- Initial Data for locations
INSERT INTO locations (name, room_number) VALUES 
('Flammables Cabinet', '101'),
('Refrigerator A', '102'),
('General Shelf 3', '101'),
('Chemical Storage Room', 'Basement');

-- Table for the equipment
DO $$ BEGIN
    CREATE TYPE equipment_status AS ENUM ('Working', 'Maintenance', 'Broken', 'Retired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE equipments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    model_number VARCHAR(100),
    serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    quantity INT NOT NULL DEFAULT 1,
    location_id INT,
    purchase_date DATE,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    status equipment_status DEFAULT 'Working',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- Table for resource bookings
DO $$ BEGIN
    CREATE TYPE booking_type AS ENUM ('Lab', 'Instrument');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    type booking_type NOT NULL,
    resource_name VARCHAR(200) NOT NULL,
    researcher_name VARCHAR(200) NOT NULL,
    booking_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Purchase Orders
DO $$ BEGIN
    CREATE TYPE po_status AS ENUM ('Pending', 'Shipped', 'Received', 'Cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    supplier VARCHAR(100) NOT NULL,
    order_date DATE NOT NULL,
    items TEXT NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status po_status DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial Data for Purchase Orders
INSERT INTO purchase_orders (po_number, supplier, order_date, items, total_cost, status) VALUES 
('PO-2023-089', 'Motewar Chemicals', '2023-11-15', 'Acetone (5L), Ethanol (2L)', 0.00, 'Received'),
('PO-2023-090', 'Bobade Acids', '2023-11-20', 'Sulfuric Acid (500ml)', 0.00, 'Shipped'),
('PO-2023-091', 'Renuka pharma', '2023-11-22', 'Glassware Set', 0.00, 'Pending');
