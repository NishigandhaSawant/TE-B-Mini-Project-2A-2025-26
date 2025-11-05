// donated_books.js - Handles the Free Donated Books page

const API_URL = "http://127.0.0.1:8000"
const token = sessionStorage.getItem("user-token") || "test-token"

sessionStorage.setItem("user-token", token)
sessionStorage.setItem("username", sessionStorage.getItem("username") || "User")

// Get elements
const resultsGallery = document.getElementById("gallery")
const loadingIndicator = document.getElementById("loading")
const paginationContainer = document.getElementById("pagination")
const cartLink = document.getElementById("cart-link")
const cartCount = document.getElementById("cart-count")
const wishlistLink = document.getElementById("wishlist-link")
const wishlistCount = document.getElementById("wishlist-count")
const themeToggle = document.getElementById("theme-toggle")

// State
let currentPage = 1
let totalPages = 1
let isLoading = false
let wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]")
let cart = [] // Needs fetching logic

// --- Helper Functions ---
function displayLoading(isLoading) {
  loadingIndicator.style.display = isLoading ? "block" : "none"
  resultsGallery.style.display = isLoading ? "none" : "grid"
}

function displayBooks(booksToDisplay) {
  resultsGallery.innerHTML = ""
  if (!booksToDisplay || booksToDisplay.length === 0) {
    resultsGallery.innerHTML =
      "<p style='text-align:center; color:#666; padding:40px; grid-column: 1/-1;'>No donated books available right now.</p>"
    return
  }

  booksToDisplay.forEach((book) => {
    const card = document.createElement("div")
    card.className = "book-card"
    card.setAttribute("data-book-id", book.id)
    card.setAttribute("data-book-type", book.book_type || book.type)

    const isInWishlist = wishlist.some((item) => item.id === book.id)
    const wishlistIcon = isInWishlist ? "❤️" : "🤍"

    card.innerHTML = `
            <img src="${book.thumbnail}"
                 onerror="this.src='https://via.placeholder.com/240x320/cccccc/ffffff?text=No+Cover'"
                 alt="${book.title}">
             <div class="wishlist-icon" onclick="toggleWishlist(event, '${
               book.id
             }', '${book.title}', '${book.authors}', '${book.thumbnail}', ${
      book.price
    }, '${book.book_type || book.type}')">${wishlistIcon}</div>
             <div class="quick-view-icon" onclick="openQuickView(event, '${
               book.id
             }', '${book.book_type || book.type}')">👁️</div>
            <div class="info">
                <h3>${book.title || "No Title"}</h3>
                <p class="author">${book.authors || "No Author"}</p>
                <p class="condition">Condition: ${book.condition || "N/A"}</p>
                <p class="price" style="color: green; font-weight: bold;">₹0.00 (Free)</p>
            </div>
            <button class="add-to-cart-btn" onclick="addToCart('${book.id}', '${
      book.book_type || book.type
    }')">
                <span class="btn-text">Add to Cart</span>
                <span class="btn-icon">🛒</span>
            </button>
        `
    resultsGallery.appendChild(card)
  })
}

function setupPagination(totalPagesNum, currentPageNum) {
  paginationContainer.innerHTML = ""
  if (totalPagesNum <= 1) return

  const displayPage = (newPage) => {
    fetchDonatedBooks(newPage) // Fetch the specific page
  }

  const prevBtn = document.createElement("button")
  prevBtn.className = "page-btn"
  prevBtn.textContent = "« Prev"
  prevBtn.disabled = currentPageNum === 1
  prevBtn.onclick = () => displayPage(currentPageNum - 1)
  paginationContainer.appendChild(prevBtn)

  paginationContainer.appendChild(
    document.createTextNode(` Page ${currentPageNum} of ${totalPagesNum} `)
  )

  const nextBtn = document.createElement("button")
  nextBtn.className = "page-btn"
  nextBtn.textContent = "Next »"
  nextBtn.disabled = currentPageNum === totalPagesNum
  nextBtn.onclick = () => displayPage(currentPageNum + 1)
  paginationContainer.appendChild(nextBtn)
}

// --- Main Fetch Function ---
async function fetchDonatedBooks(page = 1) {
  if (isLoading) return
  isLoading = true
  currentPage = page
  displayLoading(true)

  resultsGallery.innerHTML = ""
  paginationContainer.innerHTML = ""

  try {
    // Use the existing /books endpoint with source=donated
    const response = await fetch(
      `${API_URL}/books?source=donated&sort=default&page=${page}&limit=20`
    )
    if (!response.ok) throw new Error("Network response was not ok")
    const data = await response.json()

    displayBooks(data.books)
    setupPagination(data.totalPages, data.currentPage)
  } catch (error) {
    console.error("Error fetching donated books:", error)
    resultsGallery.innerHTML =
      "<p style='color:red; text-align: center;'>Could not load donated books.</p>"
  } finally {
    isLoading = false
    displayLoading(false)
  }
}

// --- Cart, Wishlist, Quick View, Theme, Logout Functions ---
// IMPORTANT: Copy ALL necessary helper functions from your `buy_premium.js` file
//              (like addToCart, updateCartCount, showCart, toggleWishlist, etc.)
//              into this file so the buttons work correctly.

// Example placeholder (COPY THE REAL ONE)
async function addToCart(bookId, bookType) {
  console.log(`Adding ${bookType} book ${bookId} to cart`)
  try {
    const response = await fetch(`${API_URL}/add-to-cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, book_id: bookId, book_type: bookType }),
    })
    if (!response.ok) throw new Error("Failed to add")
    alert("Book added to cart!")
    // updateCartCount(); // If you copied this function
  } catch (error) {
    alert("Could not add book to cart.")
    console.error(error)
  }
}
// --- END COPY SECTION ---

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", async () => {
  // updateWishlistCount(); // If copied
  // updateCartCount();     // If copied
  await fetchDonatedBooks(1) // Load initial donated books
})

document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("user-token")
  sessionStorage.removeItem("username")
})

// Theme Toggle Listener (copy from buy_premium.js)
themeToggle.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("light-theme")
    ? "dark"
    : "light"
  document.body.className = newTheme + "-theme"
  themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙"
  localStorage.setItem("theme", newTheme)
})

// Cart and Wishlist link listeners (copy from buy_premium.js)
// cartLink.addEventListener('click', (e) => { e.preventDefault(); showCart(); });
// wishlistLink.addEventListener('click', (e) => { e.preventDefault(); showWishlist(); });
