-- MySQL Database Setup for Read Rover Platform
-- Run this script to create the database and tables

-- Create the database
CREATE DATABASE IF NOT EXISTS read_rover;
USE read_rover;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User tokens table for session management
CREATE TABLE IF NOT EXISTS user_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sold books table (books listed by users for sale)
CREATE TABLE IF NOT EXISTS sold_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn13 BIGINT,
    price DECIMAL(10, 2) NOT NULL,
    `condition` VARCHAR(50),
    description TEXT,
    thumbnail VARCHAR(500) DEFAULT 'cover-not-found.jpg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_price (price),
    INDEX idx_title (title),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Donated books table (free books donated by users)
CREATE TABLE IF NOT EXISTS donated_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    condition VARCHAR(50),
    description TEXT,
    thumbnail VARCHAR(500) DEFAULT 'cover-not-found.jpg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_title (title),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    book_id BIGINT NOT NULL,
    book_type VARCHAR(20) NOT NULL, -- 'csv', 'sold', or 'donated'
    quantity INT DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_book (user_id, book_id, book_type),
    UNIQUE KEY unique_cart_item (user_id, book_id, book_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders table (for checkout functionality - future feature)
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_orders (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Order items table (for checkout functionality - future feature)
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    book_id BIGINT NOT NULL,
    book_type VARCHAR(20) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert a default admin user for testing (password: admin)
-- The password hash is for 'admin' - you should change this in production
INSERT IGNORE INTO users (username, password_hash, email) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYdXqXMvJ4W', 'admin@readrover.com');

-- Sample data for sold books (optional)
INSERT INTO sold_books (user_id, title, author, isbn13, price, `condition`, description) VALUES
(1, 'The Great Gatsby', 'F. Scott Fitzgerald', 9780743273565, 199.00, 'Like New', 'Classic American novel in excellent condition'),
(1, '1984', 'George Orwell', 9780451524935, 149.00, 'Good', 'Dystopian masterpiece'),
(1, 'To Kill a Mockingbird', 'Harper Lee', 9780061120084, 179.00, 'Very Good', 'Pulitzer Prize winning novel');

-- Sample data for donated books (optional)
INSERT INTO donated_books (user_id, title, author, `condition`, description) VALUES
(1, 'Harry Potter and the Philosophers Stone', 'J.K. Rowling', 'Good', 'First book in the magical series'),
(1, 'The Hobbit', 'J.R.R. Tolkien', 'Fair', 'Adventure classic'),
(1, 'Pride and Prejudice', 'Jane Austen', 'Very Good', 'Timeless romance');

-- Show created tables
SHOW TABLES;

-- Display table structures
DESCRIBE users;
DESCRIBE user_tokens;
DESCRIBE sold_books;
DESCRIBE donated_books;
DESCRIBE cart_items;

SELECT 'Database setup completed successfully!' AS Status;