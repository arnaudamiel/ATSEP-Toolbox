/**
 * app.js
 * Main entry point for PWA registration.
 * UI logic is handled in ui.js
 */

export function initApp() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').then(reg => {
                console.log('SW registered with scope:', reg.scope);

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateBanner();
                        }
                    });
                });
            }).catch(err => console.log('SW registration failed:', err));
        });
    }
}

/**
 * Creates and displays a non-intrusive update banner at the top of the viewport.
 * When "Reload" is clicked, it sends SKIP_WAITING to the SW and refreshes the page.
 */
function showUpdateBanner() {
    if (document.querySelector('.update-banner')) return;

    const banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.className = 'update-banner';
    banner.innerHTML = `
        <div class="update-banner-content">
            <span class="update-banner-icon">⚡</span>
            <span class="update-banner-text">A new version is available.</span>
            <button id="reload-btn" class="update-banner-btn">Reload</button>
        </div>`;

    document.body.prepend(banner);

    document.getElementById('reload-btn').addEventListener('click', () => {
        navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
    });
}
