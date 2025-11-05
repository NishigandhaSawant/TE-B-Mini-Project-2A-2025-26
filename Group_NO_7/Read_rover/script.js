// Define the address of your *Gradio App*
const GRADIO_URL = "http://127.0.0.1:7860"

// Get elements from the HTML
const queryInput = document.getElementById("query-input")
const categorySelect = document.getElementById("category-select")
const toneSelect = document.getElementById("tone-select")
const submitButton = document.getElementById("submit-button")
const resultsGallery = document.getElementById("results-gallery")

// Get the 'fn_index' for your Gradio app.
// This is usually 0 for the first .click() event.
// If this doesn't work, you can find the correct index by
// going to http://127.0.0.1:7860/info
const FN_INDEX = 0

// --- 1. Load Filters When Page Opens ---
// We can't auto-load filters this way. We have to hard-code them for now,
// or you can get them from the /info endpoint. Let's hard-code to start.

document.addEventListener("DOMContentLoaded", () => {
  // Populate category dropdown
  // NOTE: You must run your notebooks first for these to be correct.
  const categories = ["All", "Fiction", "Non-Fiction"] // Add your categories
  categories.forEach((category) => {
    const option = document.createElement("option")
    option.value = category
    option.textContent = category
    categorySelect.appendChild(option)
  })

  // Populate tone dropdown
  const tones = ["All", "Happy", "Surprising", "Angry", "Suspenseful", "Sad"]
  tones.forEach((tone) => {
    const option = document.createElement("option")
    option.value = tone
    option.textContent = tone
    toneSelect.appendChild(option)
  })
})

// --- 2. Handle the "Submit" Button Click ---
submitButton.addEventListener("click", async () => {
  const query = queryInput.value
  const category = categorySelect.value
  const tone = toneSelect.value

  resultsGallery.innerHTML = "<p>Loading...</p>" // Show loading text

  try {
    const response = await fetch(`${GRADIO_URL}/run/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fn_index: FN_INDEX,
        data: [
          query, // Corresponds to user_query
          category, // Corresponds to category_dropdown
          tone, // Corresponds to tone_dropdown
        ],
      }),
    })

    const result = await response.json()
    // The data is inside result.data[0]
    displayResults(result.data[0])
  } catch (error) {
    console.error("Error getting recommendations:", error)
    resultsGallery.innerHTML = "<p>Error loading results.</p>"
  }
})

// --- 3. Display the Results in the Gallery ---
function displayResults(recommendations) {
  resultsGallery.innerHTML = "" // Clear the loading text

  if (recommendations.length === 0) {
    resultsGallery.innerHTML = "<p>No results found.</p>"
    return
  }

  // Gradio returns an array of [image_url, caption] arrays
  recommendations.forEach((book) => {
    const imageUrl = book[0]
    const captionText = book[1]

    // Parse the caption to get title/author
    // This is a bit of a hack since Gradio combines them
    const title = captionText.split(" by ")[0]
    const authors = captionText.split(" by ")[1].split(":")[0]

    const card = document.createElement("div")
    card.className = "book-card"

    const img = document.createElement("img")
    // Gradio API might return a file path. We need to build the full URL.
    img.src = `${GRADIO_URL}/file=${imageUrl}`
    img.onerror = () => {
      img.src = "cover-not-found.jpg"
    } // Fallback image

    const captionDiv = document.createElement("div")
    captionDiv.className = "caption"

    const titleElem = document.createElement("h3")
    titleElem.textContent = title

    const authorsElem = document.createElement("p")
    authorsElem.textContent = authors

    captionDiv.appendChild(titleElem)
    captionDiv.appendChild(authorsElem)
    card.appendChild(img)
    card.appendChild(captionDiv)

    resultsGallery.appendChild(card)
  })
}
