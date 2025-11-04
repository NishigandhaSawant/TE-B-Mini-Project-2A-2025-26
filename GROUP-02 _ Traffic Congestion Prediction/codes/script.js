// --- TEMPLATE IDS ---
const NOTIFICATION_TEMPLATE_ID = 'your_notification_template_id_here'; 
// !!! REPLACE THIS WITH THE ACTUAL TEMPLATE ID YOU CREATE ON EMAILJS for verification !!!
const VERIFICATION_TEMPLATE_ID = 'your_verification_template_id_here'; 

(function () {
    emailjs.init("your_emailjs_public_key_here"); // Replace with your Public Key
})();

// ====== GLOBAL VARIABLES ======
let map, directionsService, directionsRenderer, trafficLayer;
let autocompleteStart, autocompleteEnd;
let chart;
let hasRunInitialPrediction = false;
let currentUser = null; 
let jarvisVoice = null; 
let verificationData = {}; // Stores pending signup user data and the generated code

// ===================================================
// ====== JARVIS VOICE & SPEECH SYNTHESIS LOGIC (NEW) ======
// ===================================================

function getJarvisVoice() {
    if (jarvisVoice) return jarvisVoice;
    
    const voices = window.speechSynthesis.getVoices();
    
    // 1. Prioritize a male Indian English voice (en-IN)
    jarvisVoice = voices.find(v => 
        v.lang === 'en-IN' && 
        v.name.toLowerCase().includes('male')
    );
    
    // 2. Fallback to any Indian English voice
    if (!jarvisVoice) {
        jarvisVoice = voices.find(v => 
            v.lang.includes('en-IN')
        );
    }

    // 3. Fallback to the original search (any generic male voice)
    if (!jarvisVoice) {
        jarvisVoice = voices.find(v => 
            v.lang.startsWith('en') && 
            v.name.toLowerCase().includes('male')
        );
    }

    // 4. Final fallback (any voice)
    return jarvisVoice || (voices.length > 0 ? voices[0] : null); 
}

function speakFeedback(message) {
    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            performSpeech(message);
        };
    } else {
        performSpeech(message);
    }
}
    
function performSpeech(message) {
    if ('speechSynthesis' in window) {
        const speech = new SpeechSynthesisUtterance(message);
        const voice = getJarvisVoice();
        if (voice) {
            speech.voice = voice;
        }
        speech.rate = 1.1; 
        speech.pitch = 1.0; 
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(speech);
    } else {
        console.warn("Speech synthesis not supported in this browser.");
    }
}
    
// ===================================================
// ====== ALTERNATIVE ROUTES LOGIC (NEW) ======
// ===================================================
    
function displayAlternativeRoutes(directionsResult, selectedRouteIndex = 0) {
    const listElement = document.getElementById('alternativeRoutesList');
    const sectionElement = document.getElementById('alternativeRoutesSection');
    listElement.innerHTML = '';
    sectionElement.style.display = 'none';

    if (!directionsResult.routes || directionsResult.routes.length <= 1) {
        return;
    }
    
    sectionElement.style.display = 'block';

    const allRoutes = directionsResult.routes.map((route, index) => {
        const leg = route.legs[0];
        const durationSeconds = (leg.duration_in_traffic && leg.duration_in_traffic.value) 
                                 ? leg.duration_in_traffic.value 
                                 : leg.duration.value;
        
        const startName = leg.start_address.split(',')[0].trim();
        const endName = leg.end_address.split(',')[0].trim();
        let pathDescription = `${startName}`;
        
        if (route.summary) {
            pathDescription += ` via ${route.summary}`;
        }
        pathDescription += ` → ${endName}`;

        return {
            durationSeconds: durationSeconds,
            durationText: formatDuration(durationSeconds / 60),
            pathDescription: pathDescription,
            routeIndex: index,
            isPrimary: index === selectedRouteIndex 
        };
    }).sort((a, b) => a.durationSeconds - b.durationSeconds); 

    allRoutes.forEach(route => {
        const listItem = document.createElement('li');
        listItem.className = `alt-route-item ${route.isPrimary ? 'primary-route' : ''}`;
        listItem.dataset.routeIndex = route.routeIndex;

        const pathHtml = `<div class="route-path">${route.pathDescription}</div>`;
        const timeHtml = `<div class="route-time">${route.durationText}</div>`;
        
        listItem.innerHTML = pathHtml + timeHtml;

        listItem.addEventListener('click', () => {
            document.querySelectorAll('.alt-route-item').forEach(item => item.classList.remove('primary-route'));
            listItem.classList.add('primary-route');
            directionsRenderer.setRouteIndex(route.routeIndex);
        });

        listElement.appendChild(listItem);
    });
    
    // Set the primary route index to the first (fastest) alternative
    directionsRenderer.setRouteIndex(allRoutes[0].routeIndex);
}

// ====== HELPERS (Merged from indexn.html and new14.html) ======

function setTodayDefaults() {
    const d = new Date();
    document.getElementById('date').value = d.toISOString().slice(0, 10);
    document.getElementById('time').value = d.toTimeString().slice(0, 5);
}

function formatDuration(minutes) {
    if (minutes === null) return 'N/A';
    minutes = Math.round(minutes);
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} hr ${remainingMinutes} min`;
}

function usingMyLocation() {
    const btn = document.getElementById('btnMyLocation');
    btn.disabled = true;
    btn.textContent = 'Locating…';
    if (!navigator.geolocation) {
        alert('Geolocation not supported on this device.');
        btn.disabled = false;
        btn.textContent = '📍 My location';
        return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        new google.maps.Marker({ position: latlng, map, title: 'My location' });
        map.setCenter(latlng);
        map.setZoom(14);
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: latlng }, (results, status) => {
            const startInput = document.getElementById('start');
            if (status === 'OK' && results && results[0]) {
                startInput.value = results[0].formatted_address;
            } else {
                startInput.value = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
            }
            btn.disabled = false;
            btn.textContent = '📍 My location';
        });
    }, (err) => {
        alert('Could not get your location: ' + err.message);
        btn.disabled = false;
        btn.textContent = '📍 My location';
    }, { enableHighAccuracy: true, timeout: 15000 });
}

function saveRating(rating) {
    let ratings = JSON.parse(localStorage.getItem('ratings') || '[]');
    ratings.push(parseInt(rating));
    localStorage.setItem('ratings', JSON.stringify(ratings));
}

function calculateAndDisplayOverallRating() {
    const ratings = JSON.parse(localStorage.getItem('ratings') || '[]');
    const displayElement = document.getElementById('overall-rating-display');

    if (ratings.length > 0) {
        const sum = ratings.reduce((a, b) => a + b, 0);
        const average = (sum / ratings.length).toFixed(1);
        displayElement.textContent = `Overall Rating: ${average} / 5 (${ratings.length} votes)`;
        displayElement.style.display = 'block';
    } else {
        displayElement.style.display = 'none';
    }
}
    
// Function to show loading modal
function showLoading(text, status) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingStatus').textContent = status || '';
    document.getElementById('loadingModal').style.display = 'flex';
}

// Function to hide loading modal
function hideLoading() {
    document.getElementById('loadingModal').style.display = 'none';
}

function resetSignupForm() {
    document.getElementById("name").value = "";
    document.getElementById("username").value = "";
    document.getElementById("email").value = "";
    document.getElementById("password").value = "";
    document.getElementById("confirmPassword").value = "";
    const verifyCodeInput = document.getElementById("verifyCodeInput");
    if (verifyCodeInput) verifyCodeInput.value = "";
    verificationData = {};
}

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(name, email, code) {
    showLoading("Sending Verification Email...", "Please wait. Do not close this window.");
    try {
        const templateParams = {
            to_name: name,
            user_email: email, 
            verification_code: code,
            // Minimal required fields for EmailJS
            start: "Account Verification", 
            end: "Account Verification",
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            mode: "N/A",
            nowTime: code, 
            bestOverall: "N/A",
            chartImage: "N/A",
            mapImage: "N/A",
            maplink: "N/A"
        };
        
        // Use the Verification Template ID
        // The service ID 'service_5k80ary' is also a key, but I'll leave it as is since it's an EmailJS service ID structure.
        await emailjs.send('service_5k80ary', VERIFICATION_TEMPLATE_ID, templateParams); 
        hideLoading();
        return true;
    } catch (err) {
        console.error("Email sending failed:", err);
        hideLoading();
        showLoading("Verification Email Failed", "Error sending email. Check your template ID or Public Key.");
        setTimeout(hideLoading, 3000);
        return false;
    }
}

// ====== NEWS FUNCTIONALITY (DYNAMIC) (from indexn.html) ======
function renderNewsList(articles) {
    const newsList = document.getElementById('newsList');
    newsList.innerHTML = ''; 

    if (!articles || articles.length === 0) {
        newsList.innerHTML = `<div class="small-muted" style="padding:10px; text-align:center;">No relevant news articles found for your query.</div>`;
        return;
    }

    articles.slice(0, 10).forEach(item => {
        const itemHtml = `
            <div class="news-item">
                <h4><a href="${item.url}" target="_blank" style="color:var(--text); text-decoration:none;">${item.title}</a></h4>
                <div class="news-snippet">${item.snippet || 'No snippet available.'}</div>
                <div class="news-actions">
                    <a href="${item.url}" target="_blank" class="small-muted" style="text-decoration:none;">Read More &rarr;</a>
                </div>
            </div>
        `;
        newsList.insertAdjacentHTML('beforeend', itemHtml);
    });
}

async function fetchNewsFromServer(query) {
    // NOTE: This assumes the Node server is running on port 3000 as in indexn.html
    try {
        const resp = await fetch(`http://localhost:3000/scrape?q=${encodeURIComponent(query)}`); 
        if (!resp.ok) throw new Error(`Server status ${resp.status}`);
        return resp.json();
    } catch (err) {
        // Fail gracefully and return empty articles if connection to server fails
        return { articles: [] }; 
    }
}

async function fetchAndDisplayNewsForRoute({ start, end, date, time, mode }) {
    if (!start || !end) return;

    const newsSection = document.getElementById('newsSection');
    const newsList = document.getElementById('newsList');
    newsSection.style.display = 'block';
    document.getElementById('toggleNewsBtn').textContent = 'Hide';
    newsList.innerHTML = `<div class="small-muted" style="padding:10px; text-align:center;">Loading relevant traffic advisories from server...</div>`;

    try {
        const query = buildNewsQuery({ start, end, date, time, mode });
        const data = await fetchNewsFromServer(query);
        
        renderNewsList(data.articles); 
    } catch (err) {
        console.error('Failed to fetch news:', err);
        newsList.innerHTML = `<div class="small-muted" style="color:#f87171; padding:10px; text-align:center;">
            ⚠️ **Error:** Cannot connect to Node server on port 3000. Please ensure it's running. 
        </div>`;
    }
}

function buildNewsQuery({ start, end, date, time, mode }) {
    const parts = [];
    const startParts = start.split(',').slice(0, 2).join(' ');
    const endParts = end.split(',').slice(0, 2).join(' ');
    
    parts.push(`"${startParts}" OR "${endParts}" OR "traffic"`);

    const isRaining = document.getElementById('weather').value === 'true';
    if (isRaining) {
        parts.push('rain OR flooding OR storm');
    }

    parts.push('roadworks OR "road closure" OR accident');

    const finalQuery = parts.slice(0, 5).join(' AND '); 
    return finalQuery;
}

// ====== ROUTE HISTORY LOGIC (from indexn.html) ======
function logRouteSearch(start, end, date, time, mode) {
    if (!start || !end) return;

    const normalize = (addr) => {
        const parts = addr.split(',').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 3) {
            return parts.slice(0, 2).join(', ') + ', ' + parts.slice(-1);
        }
        return addr.trim().toLowerCase();
    }

    const normalizedStart = normalize(start);
    const normalizedEnd = normalize(end);
    
    const routeKey = `${normalizedStart} -> ${normalizedEnd} | ${mode}`;
    let history = JSON.parse(localStorage.getItem('routeHistory') || '{}');

    if (!history[routeKey]) {
        history[routeKey] = {
            start: start,
            end: end,
            mode: mode,
            count: 0,
            lastSearched: new Date().toISOString()
        };
    }
    history[routeKey].count += 1;
    history[routeKey].lastSearched = new Date().toISOString();
    
    // Log all input values to allow autofill
    history[routeKey].date = document.getElementById('date').value; 
    history[routeKey].time = document.getElementById('time').value;
    history[routeKey].weather = document.getElementById('weather').value;

    localStorage.setItem('routeHistory', JSON.stringify(history));
    displayMostSearchedRoutes();
}

function displayMostSearchedRoutes() {
    const history = JSON.parse(localStorage.getItem('routeHistory') || '{}');
    const listElement = document.getElementById('mostSearchedList');
    listElement.innerHTML = '';

    const routesArray = Object.keys(history).map(key => ({ key, ...history[key] }));

    routesArray.sort((a, b) => b.count - a.count);

    const top5 = routesArray.slice(0, 5);

    if (top5.length === 0) {
        listElement.innerHTML = '<li style="color: var(--muted);">Search a route to see history...</li>';
        return;
    }

    top5.forEach(route => {
        const listItem = document.createElement('li');
        listItem.className = 'route-item';
        
        const startDisplay = route.start.split(',')[0].trim();
        const endDisplay = route.end.split(',')[0].trim();

        listItem.innerHTML = `
            ${startDisplay} ➡️ ${endDisplay} 
            <span style="color: var(--accent); margin-left: 5px;">(${route.mode.charAt(0)})</span>
            <span class="route-count">Searches: ${route.count}</span>
        `;
        // Data attributes for autofill
        listItem.dataset.start = route.start;
        listItem.dataset.end = route.end;
        listItem.dataset.mode = route.mode;
        listItem.dataset.date = route.date;
        listItem.dataset.time = route.time;
        listItem.dataset.weather = route.weather;

        listItem.addEventListener('click', autoFillRoute);
        listElement.appendChild(listItem);
    });
}

function autoFillRoute(event) {
    const item = event.currentTarget;
    document.getElementById('start').value = item.dataset.start;
    document.getElementById('end').value = item.dataset.end;
    document.getElementById('mode').value = item.dataset.mode;
    document.getElementById('date').value = item.dataset.date;
    document.getElementById('time').value = item.dataset.time;
    document.getElementById('weather').value = item.dataset.weather;
    
    plotRouteAndChart();
    document.getElementById('topbar').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ====== FAQ LOGIC (from indexn.html) ======
const faqs = [
    { question: "How is the traffic prediction calculated?", answer: "The prediction model uses historical data (from 30 days up to 1 year, depending on your selection), day of the week, time of day, and weather conditions (rainy/normal) to estimate travel time." },
    { question: "What do the different colors on the chart mean?", answer: "The chart colors indicate the expected traffic level: Teal (#00B3A6) is the best time to leave, Red (#E64A19) is the most traffic, and Yellow (#FFD066) is moderate traffic." },
    { question: "Can I get real-time traffic updates?", answer: "Yes, the 'Start Now' card provides a real-time estimate using Google's traffic data, and the map displays current traffic conditions via the traffic layer." },
    { question: "Why is a login required for notifications?", answer: "Notifications are sent via email, so a logged-in user is required to securely access your email address and personalized route information." },
    { question: "How accurate is the prediction?", answer: "While highly accurate due to the use of historical data and machine learning, external factors (accidents, sudden road closures) can affect actual travel time. Use it as a reliable estimate." }
];

function displayFAQs() {
    const listElement = document.getElementById('faqList');
    listElement.innerHTML = '';
    faqs.forEach((faq) => {
        const listItem = document.createElement('li');
        listItem.className = 'faq-item';
        
        const question = document.createElement('span');
        question.className = 'faq-question';
        question.textContent = `Q: ${faq.question}`;
        
        const answer = document.createElement('p');
        answer.className = 'faq-answer';
        answer.textContent = `A: ${faq.answer}`;
        answer.style.display = 'none';

        question.onclick = function() {
            const currentDisplay = answer.style.display;
            answer.style.display = currentDisplay === 'none' ? 'block' : 'none';
        };

        listItem.appendChild(question);
        listItem.appendChild(answer);
        listElement.appendChild(listItem);
    });
}


// ====== CORE: CHART AND ROUTE PLOTTING (Modified for Alternatives & Voice) ======

function setupChart() { 
    const ctx = document.getElementById('trafficChart').getContext('2d');
    if (chart) {
        chart.destroy();
    }
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + ':00'),
            datasets: [{
                label: 'Traffic Level',
                data: Array(24).fill(null),
                backgroundColor: [],
                borderColor: [],
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        usePointStyle: true,
                        generateLabels: (chart) => {
                            return [{
                                text: 'Best Time to Leave',
                                fontColor: '#00B3A6',
                                fillStyle: '#00B3A6',
                                strokeStyle: '#00B3A6',
                                pointStyle: 'rect',
                            }, {
                                text: 'Moderate Traffic',
                                fontColor: '#FFD066',
                                fillStyle: '#FFD066',
                                strokeStyle: '#FFD066',
                                pointStyle: 'rect',
                            }, {
                                text: 'Most Traffic',
                                fontColor: '#E64A19',
                                fillStyle: '#E64A19',
                                strokeStyle: '#E64A19',
                                pointStyle: 'rect',
                            }];
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Minutes'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hour of day'
                    }
                }
            }
        }
    });
}
function resetSummaryCards() { 
    document.getElementById('nowTime').textContent = '--:--';
    document.getElementById('nowDuration').textContent = 'Loading...';
    document.getElementById('bestTimeOverall').textContent = '--:--';
    document.getElementById('bestDurationOverall').textContent = 'Loading...';
    document.getElementById('bestTimeMorning').textContent = '--:--';
    document.getElementById('bestTimeAfternoon').textContent = '--:--';
    document.getElementById('bestTimeEvening').textContent = '--:--';
}
    
async function plotRouteAndChart() { 
    resetSummaryCards();
    const start = document.getElementById('start').value.trim();
    const end = document.getElementById('end').value.trim();
    const mode = document.getElementById('mode').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;

    if (!start || !end) {
        document.getElementById('status').textContent = 'Please fill both Start and Destination.';
        return;
    }

    logRouteSearch(start, end, date, time, mode); 

    document.getElementById('status').textContent = 'Fetching route and traffic data...';
    hasRunInitialPrediction = true;

    // This ensures the verification link only shows after a successful run
    updateAuthUI(); 

    const baseTime = time || '08:00';
    const baseDateTime = new Date(`${date}T${baseTime}:00`);
    
    if (isNaN(baseDateTime.getTime())) {
        document.getElementById('status').textContent = 'Error: Invalid date or time format.';
        return;
    }

    const dirReq = {
        origin: start,
        destination: end,
        travelMode: google.maps.TravelMode[mode],
        provideRouteAlternatives: true, // NEW: Request alternatives
        drivingOptions: (mode === 'DRIVING') ? {
            departureTime: baseDateTime,
            trafficModel: 'bestguess'
        } : undefined,
        transitOptions: (mode === 'TRANSIT') ? {
            departureTime: baseDateTime
        } : undefined
    };

    try {
        const res = await new Promise((resolve, reject) => {
            directionsService.route(dirReq, (result, status) => {
                if (status === 'OK' && result.routes && result.routes.length > 0) {
                    resolve(result);
                } else {
                    reject(status);
                }
            });
        });

        directionsRenderer.setDirections(res);
        displayAlternativeRoutes(res); // NEW: Display alternatives
        trafficLayer.setMap(map);
        map.fitBounds(res.routes[0].bounds);

        const leg = res.routes[0].legs[0];
        const km = leg.distance ? leg.distance.text : 'N/A';
        const dur = leg.duration ? leg.duration.text : 'N/A';
        document.getElementById('status').textContent = `Distance ${km} • Base duration ${dur}`;

        await getNowDuration(start, end, mode);
        await buildHourlyProfile(start, end, mode, date);

        // --- NEW: JARVIS CONDITIONAL SPEECH LOGIC ---
        const startLocation = start.split(',')[0].trim();
        const endLocation = end.split(',')[0].trim();
        let trafficStatus = "no";
        const bestDurationText = document.getElementById('bestDurationOverall').textContent;
        
        if (bestDurationText.includes('hr') && !bestDurationText.includes('1 hr')) { 
            trafficStatus = "heavy";
        } else if (bestDurationText.includes('45 min')) {
            trafficStatus = "moderate";
        } else if (bestDurationText === "No data available") {
            trafficStatus = "no clear data on";
        }
        
        let trafficMessage;
        if (trafficStatus === "heavy") {
            trafficMessage = `there seems to be significant traffic on the route from ${startLocation} to ${endLocation}.`;
        } else if (trafficStatus === "moderate") {
            trafficMessage = `I predict moderate traffic on your selected route.`;
        } else if (trafficStatus === "no clear data on") {
            trafficMessage = `I have no clear data on traffic levels for this route right now.`;
        } else {
            trafficMessage = `I don't predict major delays on the route from ${startLocation} to ${endLocation}.`;
        }

        let finalMessage = `Roger that. After processing your request, ${trafficMessage} I have provided alternative routes in case you need any help.`;
        
        // New logic: Only prompt for login if currentUser is null
        if (!currentUser) {
            finalMessage += ` Also, it's better to log in and get notified, instead of just hanging in here! Check out the new sections of FAQs and frequently asked routes below.`;
        } else {
            finalMessage += ` You are currently logged in. Remember you can click 'Get Notified' to receive an alert if conditions change. Check out the new sections of FAQs and frequently asked routes below.`;
        }

        speakFeedback(finalMessage);
        // --- END JARVIS CONDITIONAL SPEECH LOGIC ---

        fetchAndDisplayNewsForRoute({ start, end, date, time, mode });

    } catch (status) {
        document.getElementById('status').textContent = `Directions failed: ${status}. Please check your locations.`;
        document.getElementById('nowTime').textContent = '--:--';
        document.getElementById('nowDuration').textContent = 'Route not found';
        document.getElementById('bestTimeOverall').textContent = '--:--';
        document.getElementById('bestDurationOverall').textContent = 'Route not found';
        document.getElementById('bestTimeMorning').textContent = '--:--';
        document.getElementById('bestTimeAfternoon').textContent = '--:--';
        document.getElementById('bestTimeEvening').textContent = '--:--';
        
        speakFeedback("Bummer! Directions failed for that route. Please check your start and end locations and try again."); // NEW: Voice feedback
        document.getElementById('alternativeRoutesSection').style.display = 'none'; // NEW: Hide alternative routes
    }
}

async function buildHourlyProfile(start, end, mode, dateStr) { 
    document.getElementById('status').textContent = 'Building hourly profile using prediction model…';

    if (typeof trafficPredictionModel === 'undefined' || typeof trafficPredictionModel.analyze !== 'function') {
        document.getElementById('status').textContent = 'Error: Prediction model not loaded.';
        return;
    }

    const datasetKey = document.getElementById('range').value === '30' ? '1_month' :
        document.getElementById('range').value === '90' ? '3_months' :
        document.getElementById('range').value === '180' ? '6_months' :
        '1_year';

    const selectedDate = new Date(dateStr);
    const dayOfWeek = selectedDate.getDay();
    const isRaining = document.getElementById('weather').value === 'true';

    let predictionResult;
    try {
        predictionResult = await trafficPredictionModel.analyze(
            start,
            datasetKey,
            dayOfWeek,
            0,
            isRaining,
            false
        );
    } catch (e) {
        document.getElementById('status').textContent = `Prediction Error: ${e.message}`;
        predictionResult = null;
    }

    if (!predictionResult || predictionResult.error || !predictionResult.hourly_predictions) {
        document.getElementById('status').textContent = `Prediction Error: No data available for this route.`;
        document.getElementById('bestTimeOverall').textContent = '--:--';
        document.getElementById('bestDurationOverall').textContent = 'No data available';
        document.getElementById('bestTimeMorning').textContent = '--:--';
        document.getElementById('bestTimeAfternoon').textContent = '--:--';
        document.getElementById('bestTimeEvening').textContent = '--:--';
        chart.data.datasets[0].data = Array(24).fill(null);
        chart.update();
        setRangeBadge();
        return;
    }

    const labels = [];
    const mins = [];
    let bestTimeOverall = null;
    let bestDurationOverall = Infinity;
    const morning = { duration: Infinity, time: null };
    const afternoon = { duration: Infinity, time: null };
    const evening = { duration: Infinity, time: null };

    predictionResult.hourly_predictions.forEach(p => {
        labels.push(String(p.hour).padStart(2, '0') + ':00');
        const value = p.predicted_time_minutes;
        mins.push(value);

        if (value !== null && value < bestDurationOverall) {
            bestDurationOverall = value;
            bestTimeOverall = `${String(p.hour).padStart(2, '0')}:00`;
        }

        if (value !== null) {
            if (p.hour >= 5 && p.hour < 12 && value < morning.duration) {
                morning.duration = value;
                morning.time = `${String(p.hour).padStart(2, '0')}:00`;
            } else if (p.hour >= 12 && p.hour < 17 && value < afternoon.duration) {
                afternoon.duration = value;
                afternoon.time = `${String(p.hour).padStart(2, '0')}:00`;
            } else if (p.hour >= 17 &&