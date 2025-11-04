// nserver.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Ensure node-fetch is installed (npm install node-fetch@2)
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.static('.'));

// --- Scraper Logic Function ---
async function scrapeNews(query) {
    if (!query) return [];

    // URL targets Google News for the specified query, focused on India
    const url = `https://news.google.com/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    
    // Attempt to fetch the page content
    const html = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        }
    }).then(r => {
        if (!r.ok) {
            throw new Error(`Google News Fetch failed with status: ${r.status}`);
        }
        return r.text();
    });

    const $ = cheerio.load(html);

    const articles = [];
    $('article').each((i, el) => {
        const title = $(el).find('h3').text();
        let link = $(el).find('a').attr('href') || '';
        // Using a combination of known snippet selectors
        const snippet = $(el).find('.xBbh9, .sn547B').text() || ''; 

        if (title && link && articles.length < 10) {
            // Correct the link to be a full URL
            if (link.startsWith('./')) link = link.replace('./', '');
            const fullLink = link.startsWith('http') ? link : `https://news.google.com/${link}`;
            
            articles.push({
                title,
                url: fullLink,
                snippet
            });
        }
    });

    return articles;
}

// --- Main Route Handler with Fallback Strategy ---
app.get('/scrape', async (req, res) => {
    try {
        const { q: specificQuery } = req.query;
        if (!specificQuery) return res.status(400).json({ error: 'Missing query q' });

        const requiredCount = 10;
        let articles = [];
        
        // 1. Try Specific Query (from frontend: e.g., "Start End traffic")
        articles = await scrapeNews(specificQuery);

        // 2. Fallback 1: Broad Traffic/Accident keywords
        if (articles.length < requiredCount) {
            console.log(`[SCRAPE] Fallback 1: Only found ${articles.length} results. Trying broader query.`);
            const fallbackQuery1 = 'traffic accident congestion roadworks "lane closure" near ' + specificQuery.split(' ')[0];
            const fallbackArticles = await scrapeNews(fallbackQuery1);
            articles.push(...fallbackArticles);
        }

        // 3. Fallback 2: General Traffic News
        if (articles.length < requiredCount) {
            console.log(`[SCRAPE] Fallback 2: Still only ${articles.length} results. Trying general traffic news.`);
            const fallbackQuery2 = 'Latest India traffic updates road conditions';
            const fallbackArticles = await scrapeNews(fallbackQuery2);
            articles.push(...fallbackArticles);
        }
        
        // Deduplicate and trim to required count
        const uniqueArticles = Array.from(new Set(articles.map(a => a.title)))
            .map(title => articles.find(a => a.title === title));
            
        const finalArticles = uniqueArticles.slice(0, requiredCount);

        // 4. Guaranteed Output: Send a specific, link-less message if no articles are found
        if (finalArticles.length === 0) {
             const defaultArticle = {
                // The requested custom message
                title: "NO NEWS OUT THERE FOR YOUR ROUTE", 
                // Set URL to empty string to remove all links in the front-end
                url: "", 
                // Minimal snippet for a clean, simple look
                snippet: "Everything seems clear! Enjoy the easy ride."
            };
            finalArticles.push(defaultArticle);
        }

        res.json({ articles: finalArticles });
        
    } catch (err) {
        console.error('Server error during scraping:', err);
        // Ensure the error message is clear when sending 500
        res.status(500).json({ error: `Server failed to execute scraping logic. Details: ${err.message}` });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
