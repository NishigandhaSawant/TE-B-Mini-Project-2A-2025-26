"""
Quick test script to verify backend is working
Run this BEFORE starting the full server
"""

import mysql.connector
from mysql.connector import Error

print("=" * 50)
print("READ ROVER - Backend Connection Test")
print("=" * 50)

# Test 1: MySQL Connection
print("\n1. Testing MySQL Connection...")
try:
    connection = mysql.connector.connect(
        host='localhost',
        database='read_rover',
        user='root',
        password='keera@13'  # ← CHANGE THIS!
    )
    
    if connection.is_connected():
        print("   ✓ MySQL Connection: SUCCESS")
        
        cursor = connection.cursor()
        cursor.execute("SELECT DATABASE();")
        db_name = cursor.fetchone()
        print(f"   ✓ Connected to database: {db_name[0]}")
        
        # Check tables
        cursor.execute("SHOW TABLES;")
        tables = cursor.fetchall()
        print(f"   ✓ Found {len(tables)} tables:")
        for table in tables:
            print(f"     - {table[0]}")
        
        cursor.close()
        connection.close()
    else:
        print("   ✗ MySQL Connection: FAILED")
        
except Error as e:
    print(f"   ✗ MySQL Error: {e}")
    print("\n   Fix:")
    print("   1. Make sure MySQL is running")
    print("   2. Update password in this file (line 15)")
    print("   3. Create database: CREATE DATABASE read_rover;")
    exit(1)

# Test 2: Check required files
print("\n2. Checking Required Files...")
import os

required_files = [
    'books_with_emotions.csv',
    'tagged_description.txt',
    'main.py',
    'index.html',
    'buy.html',
    'buy.js',
    'style.css'
]

missing_files = []
for file in required_files:
    if os.path.exists(file):
        print(f"   ✓ {file}")
    else:
        print(f"   ✗ {file} - MISSING!")
        missing_files.append(file)

if missing_files:
    print(f"\n   ⚠ Missing {len(missing_files)} files. Please add them.")
else:
    print("\n   ✓ All required files present")

# Test 3: Check Python packages
print("\n3. Checking Python Packages...")
required_packages = {
    'fastapi': 'FastAPI',
    'uvicorn': 'Uvicorn',
    'pandas': 'Pandas',
    'mysql.connector': 'MySQL Connector',
    'passlib': 'Passlib',
    'langchain': 'LangChain'
}

missing_packages = []
for package, name in required_packages.items():
    try:
        __import__(package)
        print(f"   ✓ {name}")
    except ImportError:
        print(f"   ✗ {name} - NOT INSTALLED")
        missing_packages.append(package)

if missing_packages:
    print(f"\n   ⚠ Missing packages. Install with:")
    print("   pip install -r requirements.txt")
else:
    print("\n   ✓ All required packages installed")

# Final Summary
print("\n" + "=" * 50)
print("SUMMARY")
print("=" * 50)

if not missing_files and not missing_packages:
    print("\n✓ All checks passed! You can now start the server:")
    print("\n  python -m uvicorn main:app --reload")
    print("\n  Then open index.html in your browser")
else:
    print("\n✗ Please fix the issues above before starting the server")
    if missing_packages:
        print("\n  Run: pip install -r requirements.txt")
    if missing_files:
        print(f"\n  Add missing files: {', '.join(missing_files)}")

print("\n" + "=" * 50)