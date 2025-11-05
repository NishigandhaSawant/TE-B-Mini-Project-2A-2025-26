import pandas as pd
import numpy as np
import warnings
import math
import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import mysql.connector
from mysql.connector import Error
from passlib.context import CryptContext
import secrets
from datetime import datetime
import shutil

# --- Password Hashing Setup ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- MySQL Database Connection ---
def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host='localhost',
            database='read_rover',
            user='root',
            password='keera@13'  # Change to your MySQL password
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# --- Initialize Database Tables ---
def init_database():
    conn = get_db_connection()
    if conn is None:
        return
    
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # User tokens table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    # Sold books table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sold_books (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            author VARCHAR(255) NOT NULL,
            isbn13 BIGINT,
            price DECIMAL(10, 2) NOT NULL,
            `condition` VARCHAR(50),
            description TEXT,
            thumbnail VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    # Donated books table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS donated_books (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            author VARCHAR(255) NOT NULL,
            `condition` VARCHAR(50),
            description TEXT,
            thumbnail VARCHAR(500),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    # Cart items table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cart_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            book_id BIGINT NOT NULL,
            book_type VARCHAR(20) NOT NULL,
            quantity INT DEFAULT 1,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Database tables initialized successfully")

# --- 1. Recommender Engine Setup ---
warnings.filterwarnings("ignore", message="SentenceTransformer.encode.*")
print("Loading data from books_with_emotions.csv...")
try:
    books_df = pd.read_csv("books_with_emotions.csv")
    books_df["large_thumbnail"] = books_df["thumbnail"] + "&fife=w800"
    books_df["large_thumbnail"] = np.where(
        books_df["large_thumbnail"].isna(),
        "cover-not-found.jpg",
        books_df["large_thumbnail"],
    )
    # Generate prices between â‚¹49 and â‚¹299
    price_list = [49, 99, 149, 199, 249, 299]
    books_df['price'] = books_df['isbn13'].apply(lambda x: price_list[x % len(price_list)])
    # Generate ratings
    books_df['rating'] = books_df['isbn13'].apply(lambda x: 3 + (x % 3) * 0.5)
except FileNotFoundError:
    print("ERROR: books_with_emotions.csv not found.")
    exit()

print("Loading data from tagged_description.txt...")
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import CharacterTextSplitter
from langchain_chroma import Chroma
try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    from langchain_community.embeddings import HuggingFaceEmbeddings

raw_documents = TextLoader("tagged_description.txt", encoding="utf-8").load()
text_splitter = CharacterTextSplitter(separator="\n", chunk_size=0, chunk_overlap=0)
documents = text_splitter.split_documents(raw_documents)

print("Initializing embedding model...")
model_name = "sentence-transformers/all-MiniLM-L6-v2"
embeddings = HuggingFaceEmbeddings(
    model_name=model_name,
    model_kwargs={'device': 'cpu'},
    encode_kwargs={'normalize_embeddings': False}
)

print("Building vector database...")
db_books = Chroma.from_documents(documents, embeddings)

# Initialize database
init_database()

# Create uploads directory
os.makedirs("uploads", exist_ok=True)

print("--- Server Ready ---")

# --- 2. FastAPI App Setup ---
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- 3. Pydantic Models ---
class RecommendationRequest(BaseModel):
    query: str
    category: str
    tone: str

class UserAuth(BaseModel):
    username: str
    password: str

class UserSignup(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class CartItem(BaseModel):
    user_token: str
    book_id: int
    book_type: str = "csv"

class SellBookRequest(BaseModel):
    user_token: str
    title: str
    author: str
    price: float
    condition: str
    isbn13: Optional[int] = None
    description: Optional[str] = None

class DonateBookRequest(BaseModel):
    user_token: str
    title: str
    author: str
    condition: str
    description: Optional[str] = None

# --- 4. Helper Functions ---
def get_user_by_token(token: str):
    conn = get_db_connection()
    if conn is None:
        return None
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT u.* FROM users u
        JOIN user_tokens ut ON u.id = ut.user_id
        WHERE ut.token = %s
    """, (token,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return user

def format_book_results(dataframe: pd.DataFrame, book_type: str = "csv") -> List[dict]:
    results = []
    for _, row in dataframe.iterrows():
        authors_str = str(row.get("authors", "Unknown Author"))
        
        results.append({
            "id": int(row.get("id", row.get("isbn13", 0))),
            "thumbnail": row.get("large_thumbnail", row.get("thumbnail", "cover-not-found.jpg")),
            "title": row.get("title", "Unknown Title"),
            "authors": authors_str,
            "description": " ".join(str(row.get("description", "")).split()[:30]) + "...",
            "price": float(row.get("price", 0)),
            "rating": float(row.get("rating", 4.0)),
            "book_type": book_type
        })
    return results

# --- 5. Authentication Endpoints ---
@app.post("/signup")
async def signup(user: UserSignup):
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE username = %s", (user.username,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists")
    
    password_hash = pwd_context.hash(user.password)
    cursor.execute(
        "INSERT INTO users (username, password_hash, email) VALUES (%s, %s, %s)",
        (user.username, password_hash, user.email)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return {"status": "success", "message": "User created successfully"}

@app.post("/login")
async def login(user: UserAuth):
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (user.username,))
    db_user = cursor.fetchone()
    
    if not db_user or not pwd_context.verify(user.password, db_user['password_hash']):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = secrets.token_urlsafe(32)
    cursor.execute(
        "INSERT INTO user_tokens (user_id, token) VALUES (%s, %s)",
        (db_user['id'], token)
    )
    conn.commit()
    cursor.close()
    conn.close()
    
    return {"token": token, "username": db_user['username']}

# --- 6. Book Browsing Endpoints ---
@app.get("/all-books")
async def get_all_books(
    page: int = 1, 
    limit: int = 20, 
    sort_by: str = "default",
    min_price: float = 0,
    max_price: float = 300,
    condition: Optional[str] = None
):
    if page < 1: page = 1
    if limit < 1: limit = 20
    
    # Apply filtering
    filtered_df = books_df.copy()
    filtered_df = filtered_df[(filtered_df['price'] >= min_price) & (filtered_df['price'] <= max_price)]
    
    # Apply sorting
    if sort_by == "title_asc":
        filtered_df = filtered_df.sort_values(by="title", ascending=True)
    elif sort_by == "title_desc":
        filtered_df = filtered_df.sort_values(by="title", ascending=False)
    elif sort_by == "price_asc":
        filtered_df = filtered_df.sort_values(by="price", ascending=True)
    elif sort_by == "price_desc":
        filtered_df = filtered_df.sort_values(by="price", ascending=False)
    elif sort_by == "rating":
        filtered_df = filtered_df.sort_values(by="rating", ascending=False)
    
    total_books = len(filtered_df)
    total_pages = math.ceil(total_books / limit) if total_books > 0 else 1
    
    start_index = (page - 1) * limit
    end_index = start_index + limit
    
    paginated_books_df = filtered_df.iloc[start_index:end_index]
    book_list = format_book_results(paginated_books_df, "csv")
    
    return {
        "books": book_list,
        "currentPage": page,
        "totalPages": total_pages
    }

@app.get("/sold-books")
async def get_sold_books(
    page: int = 1, 
    limit: int = 20, 
    sort_by: str = "default",
    min_price: float = 0,
    max_price: float = 300,
    condition: Optional[str] = None
):
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor(dictionary=True)
    
    # Build WHERE clause
    where_conditions = [f"price >= {min_price}", f"price <= {max_price}"]
    if condition:
        where_conditions.append(f"`condition` = '{condition}'")
    where_clause = " AND ".join(where_conditions)
    
    # Build sort clause
    order_clause = "created_at DESC"
    if sort_by == "title_asc":
        order_clause = "title ASC"
    elif sort_by == "title_desc":
        order_clause = "title DESC"
    elif sort_by == "price_asc":
        order_clause = "price ASC"
    elif sort_by == "price_desc":
        order_clause = "price DESC"
    
    cursor.execute(f"SELECT COUNT(*) as count FROM sold_books WHERE {where_clause}")
    total_books = cursor.fetchone()['count']
    total_pages = math.ceil(total_books / limit) if total_books > 0 else 1
    
    offset = (page - 1) * limit
    cursor.execute(f"""
        SELECT id, title, author as authors, price, thumbnail, description, `condition`
        FROM sold_books
        WHERE {where_clause}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
    """, (limit, offset))
    
    books = cursor.fetchall()
    cursor.close()
    conn.close()
    
    formatted_books = []
    for book in books:
        formatted_books.append({
            "id": book['id'],
            "title": book['title'],
            "authors": book['authors'],
            "price": float(book['price']),
            "thumbnail": book.get('thumbnail', 'cover-not-found.jpg'),
            "description": book.get('description', '')[:100] + "...",
            "rating": 4.0,
            "book_type": "sold"
        })
    
    return {
        "books": formatted_books,
        "currentPage": page,
        "totalPages": total_pages
    }

@app.get("/donated-books")
async def get_donated_books(
    page: int = 1, 
    limit: int = 20, 
    sort_by: str = "default",
    condition: Optional[str] = None
):
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor(dictionary=True)
    
    where_clause = "1=1"
    if condition:
        where_clause = f"`condition` = '{condition}'"
    
    order_clause = "created_at DESC"
    if sort_by == "title_asc":
        order_clause = "title ASC"
    elif sort_by == "title_desc":
        order_clause = "title DESC"
    
    cursor.execute(f"SELECT COUNT(*) as count FROM donated_books WHERE {where_clause}")
    total_books = cursor.fetchone()['count']
    total_pages = math.ceil(total_books / limit) if total_books > 0 else 1
    
    offset = (page - 1) * limit
    cursor.execute(f"""
        SELECT id, title, author as authors, thumbnail, description, `condition`
        FROM donated_books
        WHERE {where_clause}
        ORDER BY {order_clause}
        LIMIT %s OFFSET %s
    """, (limit, offset))
    
    books = cursor.fetchall()
    cursor.close()
    conn.close()
    
    formatted_books = []
    for book in books:
        formatted_books.append({
            "id": book['id'],
            "title": book['title'],
            "authors": book['authors'],
            "price": 0,
            "thumbnail": book.get('thumbnail', 'cover-not-found.jpg'),
            "description": book.get('description', '')[:100] + "...",
            "rating": 4.0,
            "book_type": "donated",
            "condition": book.get('condition', 'Good')
        })
    
    return {
        "books": formatted_books,
        "currentPage": page,
        "totalPages": total_pages
    }

@app.post("/recommend")
async def get_recommendations(request: RecommendationRequest):
    recs = db_books.similarity_search(request.query, k=50)
    books_list = [int(rec.page_content.strip('"').split()[0]) for rec in recs]
    book_recs_df = books_df[books_df["isbn13"].isin(books_list)].head(50)

    if request.category and request.category != "All" and request.category != "":
        book_recs_df = book_recs_df[book_recs_df["simple_categories"] == request.category].head(20)
    else:
        book_recs_df = book_recs_df.head(20)

    if request.tone == "Happy": 
        book_recs_df = book_recs_df.sort_values(by="joy", ascending=False)
    elif request.tone == "Surprising": 
        book_recs_df = book_recs_df.sort_values(by="surprise", ascending=False)
    elif request.tone == "Angry": 
        book_recs_df = book_recs_df.sort_values(by="anger", ascending=False)
    elif request.tone == "Suspenseful": 
        book_recs_df = book_recs_df.sort_values(by="fear", ascending=False)
    elif request.tone == "Sad": 
        book_recs_df = book_recs_df.sort_values(by="sadness", ascending=False)
    
    return format_book_results(book_recs_df)

@app.get("/filters")
async def get_filters():
    categories = ["All"] + sorted(books_df["simple_categories"].unique().tolist())
    tones = ["All", "Happy", "Surprising", "Angry", "Suspenseful", "Sad"]
    return {"categories": categories, "tones": tones}

# --- 7. Image Upload Endpoint ---
@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    try:
        # Generate unique filename
        file_extension = file.filename.split('.')[-1]
        unique_filename = f"{secrets.token_urlsafe(16)}.{file_extension}"
        file_path = f"uploads/{unique_filename}"
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {"filename": unique_filename, "url": f"/uploads/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# --- 8. Cart Endpoints ---
@app.post("/add-to-cart")
async def add_to_cart(item: CartItem):
    user = get_user_by_token(item.user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, quantity FROM cart_items 
        WHERE user_id = %s AND book_id = %s AND book_type = %s
    """, (user['id'], item.book_id, item.book_type))
    
    existing = cursor.fetchone()
    if existing:
        cursor.execute("""
            UPDATE cart_items SET quantity = quantity + 1 
            WHERE id = %s
        """, (existing[0],))
    else:
        cursor.execute("""
            INSERT INTO cart_items (user_id, book_id, book_type) 
            VALUES (%s, %s, %s)
        """, (user['id'], item.book_id, item.book_type))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return {"status": "success", "message": "Book added to cart"}

@app.get("/cart")
async def get_cart(user_token: str):
    user = get_user_by_token(user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT * FROM cart_items WHERE user_id = %s
    """, (user['id'],))
    
    cart_items = cursor.fetchall()
    cursor.close()
    conn.close()
    
    detailed_cart = []
    for item in cart_items:
        book_info = None
        if item['book_type'] == 'csv':
            book = books_df[books_df['isbn13'] == item['book_id']]
            if not book.empty:
                book_info = {
                    "cart_id": item['id'],
                    "book_id": item['book_id'],
                    "title": book.iloc[0]['title'],
                    "authors": book.iloc[0]['authors'],
                    "price": float(book.iloc[0]['price']),
                    "quantity": item['quantity'],
                    "thumbnail": book.iloc[0]['large_thumbnail'],
                    "book_type": "csv"
                }
        elif item['book_type'] == 'sold':
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM sold_books WHERE id = %s", (item['book_id'],))
            book = cursor.fetchone()
            cursor.close()
            conn.close()
            if book:
                book_info = {
                    "cart_id": item['id'],
                    "book_id": item['book_id'],
                    "title": book['title'],
                    "authors": book['author'],
                    "price": float(book['price']),
                    "quantity": item['quantity'],
                    "thumbnail": book.get('thumbnail', 'cover-not-found.jpg'),
                    "book_type": "sold"
                }
        elif item['book_type'] == 'donated':
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM donated_books WHERE id = %s", (item['book_id'],))
            book = cursor.fetchone()
            cursor.close()
            conn.close()
            if book:
                book_info = {
                    "cart_id": item['id'],
                    "book_id": item['book_id'],
                    "title": book['title'],
                    "authors": book['author'],
                    "price": 0,
                    "quantity": item['quantity'],
                    "thumbnail": book.get('thumbnail', 'cover-not-found.jpg'),
                    "book_type": "donated"
                }
        
        if book_info:
            detailed_cart.append(book_info)
    
    return {"cart": detailed_cart}

@app.delete("/cart/{cart_id}")
async def remove_from_cart(cart_id: int, user_token: str):
    user = get_user_by_token(user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cart_items WHERE id = %s AND user_id = %s", (cart_id, user['id']))
    conn.commit()
    cursor.close()
    conn.close()
    
    return {"status": "success"}

# --- 9. Sell & Donate Endpoints ---
@app.post("/sell-book")
async def sell_book(request: SellBookRequest):
    user = get_user_by_token(request.user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sold_books (user_id, title, author, isbn13, price, `condition`, description, thumbnail)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (user['id'], request.title, request.author, request.isbn13, request.price, 
          request.condition, request.description, 'cover-not-found.jpg'))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return {"status": "success", "message": "Book listed for sale successfully"}

@app.post("/donate-book")
async def donate_book(request: DonateBookRequest):
    user = get_user_by_token(request.user_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO donated_books (user_id, title, author, `condition`, description, thumbnail)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (user['id'], request.title, request.author, request.condition, 
          request.description, 'cover-not-found.jpg'))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return {"status": "success", "message": "Book donated successfully"}

# Serve uploaded files
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")