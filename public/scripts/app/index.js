/**
 * Akhilesh Angadi Portfolio — Hero Typed Animation
 *
 * Initialises the Typed.js text carousel on the hero section using strings
 * passed from the server via the data-strings attribute on the script tag.
 *
 * Dependencies:
 *   - Typed.js (CDN global)  — typewriter animation library
 *
 * Usage:
 *   Loaded as <script id="index-script" data-strings="[...]" src="/scripts/app/index.js">
 *   on views/index.ejs only.
 *
 * Author: Akhilesh Angadi
 */
document.addEventListener('DOMContentLoaded', () => {
    // Check if the script tag has a data-strings attribute
    const scriptTag = document.getElementById('index-script');
    let strings = [];
    if (scriptTag) {
        try {
            const raw = scriptTag.getAttribute('data-strings');
            if (raw) strings = JSON.parse(raw);
        } catch(e) { console.error("Could not parse typed strings", e); }
    }

    if (strings.length > 0 && document.getElementById('typed-headline')) {
        new Typed('#typed-headline', {
        strings: strings,
        typeSpeed: 60,
        backSpeed: 40,
        backDelay: 1500,
        loop: true
        });
    }
});
