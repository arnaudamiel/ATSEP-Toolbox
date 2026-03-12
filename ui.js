import { ATSEP_CONSTANTS, STORAGE_KEYS } from './constants.js';
import { SafeStorage, renderCoordInputs, onCoordFormatChange, setCoordFormat } from './ui/shared-ui.js';
import { initQnh } from './ui/qnh-ui.js';
import { initRange } from './ui/range-ui.js';
import { initDest } from './ui/dest-ui.js';
import { initMagVar } from './ui/magvar-ui.js';
import { initGps } from './ui/gps-ui.js';
import { initApp } from './app.js';


/**
 * Initialize tab state from saved preference or default.
 */
function initTabs() {
    const lastTabId = SafeStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'qnh-panel';
    const btn = document.querySelector(`.tab-btn[data-tab="${lastTabId}"]`) || document.querySelector('.tab-btn');
    if (btn) switchTab(btn);
}

/**
 * Switches the active tab in the UI.
 */
function switchTab(targetBtn) {
    // Deactivate all
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // Activate target
    targetBtn.classList.add('active');
    const panelId = targetBtn.getAttribute('data-tab');
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');

    SafeStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, panelId);
}

/**
 * Restore saved input values from localStorage.
 */
function inputRestoration() {
    document.querySelectorAll('.save-val').forEach(el => {
        const saved = SafeStorage.getItem(el.id);
        if (saved !== null) el.value = saved;
    });
}

function updateDistUnit(val) {
    document.querySelectorAll('#range_unit_type, #d_unit').forEach(el => {
        el.value = val;
    });
    SafeStorage.setItem(STORAGE_KEYS.RANGE_UNIT, val);
    SafeStorage.setItem(STORAGE_KEYS.DEST_UNIT, val);
}

function initEasterEgg() {
    const titles = document.querySelectorAll('.app-title');
    const ducky = document.querySelector('.ducky-mascot');
    let timer;

    const start = () => {
        timer = setTimeout(() => {
            if (ducky) ducky.classList.add('visible');
        }, ATSEP_CONSTANTS.EASTER_EGG_DELAY_MS);
    };

    const cancel = () => {
        clearTimeout(timer);
    };

    titles.forEach(t => {
        t.addEventListener('mousedown', start);
        t.addEventListener('touchstart', start, { passive: true });
        t.addEventListener('mouseup', cancel);
        t.addEventListener('mouseleave', cancel);
        t.addEventListener('touchend', cancel);
        t.addEventListener('touchcancel', cancel);
    });
}


function attachGlobalListeners() {
    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.currentTarget));
    });

    const fmtSelectors = ['range_fmt_sel', 'dest_fmt_sel', 'mag_fmt_sel', 'gps_fmt_sel'];
    fmtSelectors.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => setCoordFormat(e.target.value));
            onCoordFormatChange(fmt => { el.value = fmt; });
        }
    });

    // Register renderer for inputs
    onCoordFormatChange(() => window.updateDependentUI());

    // Register calculation re-runs
    onCoordFormatChange(() => {
        const rangeBtn = document.querySelector('#range-panel .calculate-btn');
        const destBtn = document.querySelector('#dest-panel .calculate-btn');
        const magBtn = document.querySelector('#mag-panel .calculate-btn');
        
        if (rangeBtn && document.getElementById('range_res').innerText !== '---') rangeBtn.click();
        if (destBtn && document.getElementById('dest_res').innerText !== '---') destBtn.click();
        if (magBtn && document.getElementById('mag_res').innerText !== '---') magBtn.click();
        if (typeof window.updateGPSUI === 'function') window.updateGPSUI();
    });

    // Unit Selection
    const unitSelectors = ['range_unit_type', 'd_unit'];
    unitSelectors.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', (e) => updateDistUnit(e.target.value));
    });

    // Input Savings (Auto-save) with debouncing
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('save-val') && e.target.id) {
            const el = e.target;
            if (el.saveTimeout) clearTimeout(el.saveTimeout);
            el.saveTimeout = setTimeout(() => {
                SafeStorage.setItem(el.id, el.value);
            }, ATSEP_CONSTANTS.DEBOUNCE_DELAY_MS);
        }
    });

    // Click-and-hold to copy
    document.querySelectorAll('.copy-target').forEach(el => {
        let pressTimer;
        const startCopyTimer = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return; // Only trigger on left click
            pressTimer = setTimeout(() => {
                navigator.clipboard.writeText(el.innerText).then(() => {
                    // Visual feedback flash
                    el.classList.add('flash-copied');
                    setTimeout(() => {
                        el.classList.remove('flash-copied');
                    }, 200);
                }).catch(err => console.error('Copy failed', err));
            }, 1000); // 1 second hold
        };
        const cancelCopyTimer = () => {
            if (pressTimer) clearTimeout(pressTimer);
        };

        el.addEventListener('mousedown', startCopyTimer);
        el.addEventListener('touchstart', startCopyTimer, { passive: true });
        el.addEventListener('mouseup', cancelCopyTimer);
        el.addEventListener('mouseleave', cancelCopyTimer);
        el.addEventListener('touchend', cancelCopyTimer);
        el.addEventListener('touchcancel', cancelCopyTimer);
    });
}

// Hook to trigger Dependent UI Update for coordinate formats (handled in range-ui or shared, called dynamically)
window.updateDependentUI = function() {
    renderCoordInputs(['r_origin', 'r_dest', 'd_start', 'mag_coord']);
    
    // Re-bind click-to-copy to newly created elements if necessary, 
    // or just rely on the static event delegation logic.
    
    // Restore other inputs
    inputRestoration();
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize PWA Service Worker
    initApp();

    // Setup Global Layout
    attachGlobalListeners();
    initEasterEgg();
    
    // Initialize coordinate inputs first so that component init can find them
    window.updateDependentUI(); 

    // Initialize individual module UIs
    initQnh();
    initRange();
    initDest();
    initMagVar();
    initGps();
    
    // Select tab last after everything is built
    initTabs();
});
