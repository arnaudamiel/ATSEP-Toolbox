import { WMMHR } from '../wmmhr.js';
import { setTabStatus } from './shared-ui.js';
import { validateAndGetCoords } from './range-ui.js';

let elements = {};

function cacheElements() {
    elements = {
        magDate: document.getElementById('mag_date'),
        magRes: document.getElementById('mag_res')
    };
}

async function initWMMHR() {
    if (typeof WMMHR === 'undefined') {
        console.error("WMMHR module not loaded");
        return;
    }

    WMMHR.load((status, err) => {
        if (status === 'loading') setTabStatus('mag', 'loading');
        else if (status === 'ready') setTabStatus('mag', 'ready');
        else if (status === 'error') setTabStatus('mag', 'error', `Failed to load WMMHR: ${err}`);
    }).catch(() => {});
}

function dateToDecimalYear(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const dayOfYear = (date - start) / (1000 * 60 * 60 * 24);
    const daysInYear = (end - start) / (1000 * 60 * 60 * 24);
    return year + (dayOfYear / daysInYear);
}

function runMag() {
    const coords = validateAndGetCoords('mag_coord', 'mag_res');
    if (!coords) return;

    const dateStr = elements.magDate ? elements.magDate.value : null;
    if (!dateStr) {
        elements.magRes.innerHTML = '<span class="result-error">Please select a date.</span>';
        return;
    }

    const year = dateToDecimalYear(dateStr);
    const altKm = 0; // Default to MSL

    try {
        if (!WMMHR.isInitialized()) {
            elements.magRes.innerHTML = '<span class="result-error">Model not initialized. Check internet/files.</span>';
            initWMMHR(); // Try again
            return;
        }

        const epoch = WMMHR.getEpoch();
        const epochRounded = Math.round(epoch);
        let warningMsg = '';

        if (year < epoch) {
            elements.magRes.innerHTML = `<span class="result-error">Date cannot be before model epoch ${epochRounded}.</span>`;
            return;
        }

        if (year > epoch + 5.0) {
            warningMsg = `<div class="result-warning" style="margin-bottom:8px; font-size:0.9em; color:white;">Warning: Date is >5 years past epoch ${epochRounded}. Results may be inaccurate.</div>`;
        }

        const res = WMMHR.calc(coords.lat, coords.lon, altKm, year);

        const formatChange = (val, unit) => {
            const dir = val >= 0 ? "E" : "W";
            return `${Math.abs(val).toFixed(2)}${unit} ${dir}`;
        };

        const html = `
            ${warningMsg}
            <div class="result-row">
                <span class="label">Variation:</span> 
                <span class="val" style="font-weight:bold; color:white;">${Math.abs(res.D).toFixed(2)}° ${res.D >= 0 ? 'E' : 'W'}</span>
            </div>
            <div class="result-row" style="font-size: 0.9em; opacity: 0.8; color:white;">
                <span class="label">Annual Change:</span> <span class="val" style="font-weight:bold; color:white;">${formatChange(res.dD, "°")}</span>
            </div>
        `;
        elements.magRes.innerHTML = html;

    } catch (e) {
        elements.magRes.innerHTML = `<span class="result-error">Error: ${e.message}</span>`;
    }
}

export function initMagVar() {
    cacheElements();
    initWMMHR(); // Load WMM data eagerly

    const magBtn = document.querySelector('#mag-panel .calculate-btn');
    if (magBtn) magBtn.addEventListener('click', runMag);
}
