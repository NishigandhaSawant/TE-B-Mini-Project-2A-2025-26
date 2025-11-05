// buy_premium.js - Modified version (All filter logic removed)

const API_URL = "http://127.0.0.1:8000"
const token = sessionStorage.getItem("user-token") || "test-token"

sessionStorage.setItem("user-token", token)
sessionStorage.setItem("username", "admin")

// 'currentSource' variable removed
let currentPage = 1
let currentSort = "default"
let currentMinPrice = 0
let currentMaxPrice = 300
let currentCondition = null
let allBooks = []
let displayedBooks = 0
let isLoading = false
let isAISearch = false
let wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]")
let cart = []
let discount = 0

// Coupon codes
const coupons = {
  BOOK10: 10,
  BOOK20: 20,
  SAVE50: 50,
  READER15: 15,
}

// Theme Toggle
const themeToggle = document.getElementById("theme-toggle")
const currentTheme = localStorage.getItem("theme") || "light"
document.body.className = currentTheme + "-theme"
themeToggle.textContent = currentTheme === "dark" ? "☀️" : "🌙"

themeToggle.addEventListener("click", () => {
  const newTheme = document.body.classList.contains("light-theme")
    ? "dark"
    : "light"
  document.body.className = newTheme + "-theme"
  themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙"
  localStorage.setItem("theme", newTheme)
})

// Mini Cart Hover
const cartWrapper = document.querySelector(".cart-wrapper")
const miniCart = document.getElementById("mini-cart")

cartWrapper.addEventListener("mouseenter", () => {
  updateMiniCart()
  miniCart.classList.add("show")
})

cartWrapper.addEventListener("mouseleave", () => {
  miniCart.classList.remove("show")
})

// Skeleton Loading
function showSkeleton() {
  document.getElementById("skeleton-loader").style.display = "grid"
  document.getElementById("results-gallery").style.display = "none"
}

function hideSkeleton() {
  document.getElementById("skeleton-loader").style.display = "none"
  document.getElementById("results-gallery").style.display = "grid"
}

// Display Books with Animation
function displayBooks(books, append = false) {
  const gallery = document.getElementById("results-gallery")
  if (!append) {
    gallery.innerHTML = ""
    displayedBooks = 0
  }

  if (books.length === 0 && !append) {
    gallery.innerHTML =
      "<p style='text-align:center; color:#666; padding:40px;'>No books found matching your criteria.</p>"
    return
  }

  books.forEach((book, index) => {
    const rating = book.rating || (3 + Math.random() * 2).toFixed(1)
    const priceDisplay =
      book.price === 0
        ? '<p class="book-price free-book">FREE</p>'
        : `<p class="book-price">₹${book.price.toFixed(2)}</p>`

    // This logic is now redundant but harmless to leave
    const bookTypeLabel =
      book.book_type === "donated"
        ? '<span class="book-type-badge donated">Donated</span>'
        : book.book_type === "sold"
        ? '<span class="book-type-badge sold">User-Sold</span>'
        : ""

    const isInWishlist = wishlist.includes(book.id)
    const heartIcon = isInWishlist ? "❤️" : "🤍"

    const card = document.createElement("div")
    card.className = "book-card fade-in"
    card.style.animationDelay = `${(index % 20) * 0.05}s`
    card.innerHTML = `
            ${bookTypeLabel}
            <button class="wishlist-btn" onclick="toggleWishlist(${
              book.id
            }, event)">
                ${heartIcon}
            </button>
            <img src="${
              book.thumbnail
            }" onerror="this.src='cover-not-found.jpg'" 
                 onclick="showQuickView(${JSON.stringify(book).replace(
                   /"/g,
                   "&quot;"
                 )})">
            <div class="caption">
                <h3>${book.title || "No Title"}</h3>
                <p class="book-author">${book.authors || "No Author"}</p>
                <div class="book-rating">
                    ${"★".repeat(Math.floor(rating))}${"☆".repeat(
      5 - Math.floor(rating)
    )}
                    <span class="rating-value">${rating}</span>
                </div>
                ${priceDisplay}
            </div>
            <div class="card-actions">
                <button class="quick-view-btn" onclick="showQuickView(${JSON.stringify(
                  book
                ).replace(/"/g, "&quot;")})">
                    Quick View
                </button>
                <button class="add-to-cart-btn" onclick="addToCart(${
                  book.id
                }, '${book.book_type}', ${book.price}, '${book.title.replace(
      /'/g,
      "\\'"
    )}', '${book.thumbnail}', event)">
                    Add to Cart
                </button>
            </div>
        `
    gallery.appendChild(card)
  })

  displayedBooks += books.length
}

// Wishlist Functions
function toggleWishlist(bookId, event) {
  event.stopPropagation()
  const index = wishlist.indexOf(bookId)
  if (index > -1) {
    wishlist.splice(index, 1)
  } else {
    wishlist.push(bookId)
  }
  localStorage.setItem("wishlist", JSON.stringify(wishlist))
  updateWishlistCount()

  const btn = event.target
  btn.textContent = wishlist.includes(bookId) ? "❤️" : "🤍"

  btn.classList.add("heart-pulse")
  setTimeout(() => btn.classList.remove("heart-pulse"), 300)
}

function updateWishlistCount() {
  document.getElementById("wishlist-count").textContent = wishlist.length
}

function showWishlist() {
  const modal = document.getElementById("wishlist-modal")
  const container = document.getElementById("wishlist-items")

  if (wishlist.length === 0) {
    container.innerHTML =
      '<p style="text-align:center;padding:40px;">Your wishlist is empty</p>'
  } else {
    container.innerHTML =
      "<p>Wishlist items (IDs): " + wishlist.join(", ") + "</p>"
  }

  modal.style.display = "block"
}

function closeWishlist() {
  document.getElementById("wishlist-modal").style.display = "none"
}

// Quick View
function showQuickView(book) {
  const modal = document.getElementById("quick-view-modal")
  const content = document.getElementById("quick-view-content")
  const rating = book.rating || (3 + Math.random() * 2).toFixed(1)

  content.innerHTML = `
        <div class="quick-view-layout">
            <img src="${
              book.thumbnail
            }" onerror="this.src='cover-not-found.jpg'">
            <div class="quick-view-details">
                <h2>${book.title}</h2>
                <p class="author">by ${book.authors}</p>
                <div class="book-rating">
                    ${"★".repeat(Math.floor(rating))}${"☆".repeat(
    5 - Math.floor(rating)
  )}
                    <span>${rating}/5</span>
                </div>
                <p class="price">₹${book.price.toFixed(2)}</p>
                <p class="description">${book.description}</p>
                <div class="quick-actions">
                    <button onclick="addToCart(${book.id}, '${
    book.book_type
  }', ${book.price}, '${book.title.replace(/'/g, "\\'")}', '${
    book.thumbnail
  }', event)" class="add-to-cart-btn">
                        Add to Cart
                    </button>
                    <button onclick="toggleWishlist(${
                      book.id
                    }, event)" class="wishlist-btn">
                        ${
                          wishlist.includes(book.id)
                            ? "❤️ In Wishlist"
                            : "🤍 Add to Wishlist"
                        }
                    </button>
                </div>
            </div>
        </div>
    `

  modal.style.display = "block"
}

function closeQuickView() {
  document.getElementById("quick-view-modal").style.display = "none"
}

// Cart Functions
function addToCart(bookId, bookType, price, title, thumbnail, event) {
  if (event) event.stopPropagation()

  const existing = cart.find(
    (item) => item.id === bookId && item.type === bookType
  )
  if (existing) {
    existing.quantity++
  } else {
    cart.push({
      id: bookId,
      type: bookType,
      price: price,
      title: title,
      thumbnail: thumbnail,
      quantity: 1,
    })
  }

  updateCartCount()
  updateMiniCart()

  if (event && event.target) {
    const btn = event.target
    const originalText = btn.innerText
    btn.innerText = "✓ Added!"
    btn.style.backgroundColor = "#28a745"

    setTimeout(() => {
      btn.innerText = originalText
      btn.style.backgroundColor = ""
    }, 1500)
  }
}

function updateCartCount() {
  const total = cart.reduce((sum, item) => sum + item.quantity, 0)
  document.getElementById("cart-count").textContent = total
}

function updateMiniCart() {
  const container = document.getElementById("mini-cart-items")
  const totalEl = document.getElementById("mini-cart-total")

  if (cart.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; padding:20px; color:#999;">Cart is empty</p>'
    totalEl.textContent = "0.00"
    return
  }

  let total = 0
  container.innerHTML = ""

  cart.slice(0, 3).forEach((item) => {
    total += item.price * item.quantity
    container.innerHTML += `
            <div class="mini-cart-item">
                <img src="${item.thumbnail}" alt="${item.title}">
                <div>
                    <p>${item.title.substring(0, 30)}...</p>
                    <span>₹${item.price} x ${item.quantity}</span>
                </div>
            </div>
        `
  })

  if (cart.length > 3) {
    container.innerHTML += `<p style="text-align:center; color:#999;">+${
      cart.length - 3
    } more items</p>`
  }

  totalEl.textContent = total.toFixed(2)
}

function openFullCart() {
  const modal = document.getElementById("cart-modal")
  const container = document.getElementById("cart-items")

  if (cart.length === 0) {
    container.innerHTML =
      '<p style="text-align:center;padding:40px;">Your cart is empty</p>'
    document.getElementById("cart-subtotal").textContent = "0.00"
    document.getElementById("cart-total").textContent = "0.00"
  } else {
    let subtotal = 0
    container.innerHTML = ""

    cart.forEach((item, index) => {
      const itemTotal = item.price * item.quantity
      subtotal += itemTotal

      container.innerHTML += `
                <div class="cart-item">
                    <img src="${item.thumbnail}" alt="${item.title}">
                    <div class="cart-item-details">
                        <h4>${item.title}</h4>
                        <p class="cart-item-price">₹${item.price.toFixed(
                          2
                        )} x ${item.quantity}</p>
                    </div>
                    <div class="cart-item-actions">
                        <p class="cart-item-total">₹${itemTotal.toFixed(2)}</p>
                        <button onclick="removeFromCart(${index})" class="remove-btn">Remove</button>
                    </div>
                </div>
            `
    })

    document.getElementById("cart-subtotal").textContent = subtotal.toFixed(2)
    const total = subtotal - discount
    document.getElementById("cart-total").textContent = total.toFixed(2)

    if (discount > 0) {
      document.getElementById("discount-row").style.display = "flex"
      document.getElementById("discount-amount").textContent =
        discount.toFixed(2)
    }
  }

  modal.style.display = "block"
}

function removeFromCart(index) {
  cart.splice(index, 1)
  updateCartCount()
  openFullCart()
  updateMiniCart()
}

function closeCart() {
  document.getElementById("cart-modal").style.display = "none"
}

function applyCoupon() {
  const input = document.getElementById("coupon-input")
  const message = document.getElementById("coupon-message")
  const code = input.value.toUpperCase()

  if (coupons[code]) {
    discount = coupons[code]
    document.getElementById("discount-row").style.display = "flex"
    document.getElementById("discount-amount").textContent = discount.toFixed(2)

    const subtotal = parseFloat(
      document.getElementById("cart-subtotal").textContent
    )
    const total = Math.max(0, subtotal - discount)
    document.getElementById("cart-total").textContent = total.toFixed(2)

    message.textContent = `✓ Coupon applied! ₹${discount} off`
    message.style.color = "green"
    input.value = ""
  } else {
    message.textContent = "✗ Invalid coupon code"
    message.style.color = "red"
  }

  setTimeout(() => (message.textContent = ""), 3000)
}

function checkout() {
  const successModal = document.getElementById("checkout-success")
  successModal.classList.add("show")

  setTimeout(() => {
    successModal.classList.remove("show")
    cart = []
    discount = 0
    updateCartCount()
    closeCart()
  }, 3000)
}

// Fetch Books
async function fetchBooks(page = 1, append = false) {
  if (isLoading) return
  isLoading = true
  isAISearch = false

  if (!append) showSkeleton()
  else document.getElementById("loading-indicator").style.display = "block"

  // Endpoint is now always 'all-books'
  let endpoint = `${API_URL}/all-books?page=${page}&limit=20&sort_by=${currentSort}&min_price=${currentMinPrice}&max_price=${currentMaxPrice}`

  // 'donated' logic removed

  if (currentCondition) {
    endpoint += `&condition=${currentCondition}`
  }

  try {
    const response = await fetch(endpoint)
    const data = await response.json()

    hideSkeleton()
    document.getElementById("loading-indicator").style.display = "none"

    displayBooks(data.books, append)
    allBooks = append ? [...allBooks, ...data.books] : data.books

    const loadMoreBtn = document.getElementById("load-more-btn")
    if (data.currentPage >= data.totalPages) {
      loadMoreBtn.style.display = "none"
    } else {
      loadMoreBtn.style.display = "block"
    }

    currentPage = data.currentPage
  } catch (error) {
    console.error("Error:", error)
    hideSkeleton()
    document.getElementById("results-gallery").innerHTML =
      "<p style='color:red; text-align:center; padding:40px;'>Error loading books. Please try again.</p>"
  }

  isLoading = false
}

// AI Recommendation
async function fetchRecommendations() {
  const query = document.getElementById("query-input").value.trim()
  const category = document.getElementById("category-select").value
  const tone = document.getElementById("tone-select").value

  if (!query) {
    alert("Please enter a description to get AI recommendations!")
    return
  }

  isAISearch = true
  showSkeleton()
  document.getElementById("results-title").textContent = "🤖 AI Recommendations"
  document.getElementById("show-all-button").style.display = "block"
  document.getElementById("load-more-btn").style.display = "none"

  try {
    const response = await fetch(`${API_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query,
        category: category || "All",
        tone: tone || "All",
      }),
    })

    if (!response.ok) throw new Error("AI search failed")

    const books = await response.json()
    hideSkeleton()
    displayBooks(books)
  } catch (error) {
    console.error("Error:", error)
    hideSkeleton()
    document.getElementById("results-gallery").innerHTML =
      "<p style='color:red; text-align:center; padding:40px;'>AI search failed. Please try again.</p>"
  }
}

// --- switchSource function removed ---

// Load More
document.getElementById("load-more-btn").addEventListener("click", () => {
  fetchBooks(currentPage + 1, true)
})

// Show All Books Button
document.getElementById("show-all-button").addEventListener("click", () => {
  document.getElementById("query-input").value = ""
  document.getElementById("show-all-button").style.display = "none"
  document.getElementById("results-title").textContent = "All Books"
  fetchBooks(1)
})

// AI Search Button
document
  .getElementById("search-button")
  .addEventListener("click", fetchRecommendations)

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  updateWishlistCount()
  updateCartCount()

  try {
    // We still fetch the filters, as they are used by the AI search
    const response = await fetch(`${API_URL}/filters`)
    const data = await response.json()

    const categorySelect = document.getElementById("category-select")
    data.categories.forEach((c) => {
      const option = document.createElement("option")
      option.value = c
      option.text = c
      categorySelect.appendChild(option)
    })

    const toneSelect = document.getElementById("tone-select")
    data.tones.forEach((t) => {
      const option = document.createElement("option")
      option.value = t
      option.text = t
      toneSelect.appendChild(option)
    })
  } catch (error) {
    console.error("Error loading filters:", error)
  }

  await fetchBooks(1)
})

document.getElementById("wishlist-link").addEventListener("click", (e) => {
  e.preventDefault()
  showWishlist()
})

document.getElementById("cart-link").addEventListener("click", (e) => {
  e.preventDefault()
})

// Close modals on outside click
window.onclick = function (event) {
  if (event.target.classList.contains("modal")) {
    event.target.style.display = "none"
  }
}
