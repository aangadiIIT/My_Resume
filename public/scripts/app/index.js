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
