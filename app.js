/**
 * app.js
 * Main entry point for PWA registration.
 * UI logic is handled in ui.js
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('SW registered with scope:', registration.scope))
            .catch(err => console.log('SW registration failed:', err));
    });
}
