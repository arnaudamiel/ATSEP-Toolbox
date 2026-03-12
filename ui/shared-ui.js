import { STORAGE_KEYS } from '../constants.js';

/**
 * Safe wrapper for localStorage operations.
 * Handles cases where localStorage is unavailable (e.g., private browsing mode).
 */
export const SafeStorage = {
    _available: null,

    isAvailable() {
        if (this._available !== null) return this._available;
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            this._available = true;
        } catch (e) {
            this._available = false;
            console.warn('localStorage is unavailable. Settings will not persist.');
        }
        return this._available;
    },

    getItem(key) {
        if (!this.isAvailable()) return null;
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage read failed:', e);
            return null;
        }
    },

    setItem(key, value) {
        if (!this.isAvailable()) return;
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('localStorage write failed:', e);
        }
    }
};

/**
 * Updates the status message for a specific tab.
 */
export function setTabStatus(tabId, status, msg) {
    let elId;
    if (tabId === 'gps') elId = 'gps_status';
    else if (tabId === 'mag') elId = 'mag_res';
    else return;

    const el = document.getElementById(elId);
    if (!el) return;

    if (status === 'loading') {
        el.textContent = msg || (tabId === 'gps' ? "Loading geoid model..." : "Loading magnetic model...");
        el.className = "warning-text text-center mb-half";
    } else if (status === 'ready') {
        el.textContent = msg || (tabId === 'gps' ? "Ready to start" : "Ready");
        el.className = tabId === 'gps' ? "warning-text text-center mb-half" : "result-success text-center mb-half";
    } else if (status === 'error') {
        el.textContent = msg || "Error loading data.";
        el.className = "result-error text-center mb-half";
    }
}

/**
 * Formats a single coordinate based on the selected format.
 */
export function formatCoord(deg, isLat) {
    if (isNaN(deg)) return '--';
    const fmt = SafeStorage.getItem(STORAGE_KEYS.COORD_FMT) || 'DD';
    const num = Math.abs(deg);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');

    if (fmt === 'DD') {
        return `${num.toFixed(5)}° ${dir}`;
    } else if (fmt === 'DDM') {
        const d = Math.floor(num);
        const m = ((num - d) * 60).toFixed(4);
        return `${d}° ${m}' ${dir}`;
    } else { // DMS
        const d = Math.floor(num);
        const mFull = (num - d) * 60;
        const m = Math.floor(mFull);
        const s = ((mFull - m) * 60).toFixed(2);
        return `${d}° ${m}' ${s}" ${dir}`;
    }
}

/**
 * Shared Reactive State for Coordinate Formats
 */
const coordFormatListeners = new Set();

export function onCoordFormatChange(fn) {
    coordFormatListeners.add(fn);
    return () => coordFormatListeners.delete(fn);
}

export function setCoordFormat(fmt) {
    SafeStorage.setItem(STORAGE_KEYS.COORD_FMT, fmt);
    SafeStorage.setItem('range_fmt_sel', fmt);
    SafeStorage.setItem('dest_fmt_sel', fmt);
    SafeStorage.setItem('mag_fmt_sel', fmt);
    SafeStorage.setItem('gps_fmt_sel', fmt);
    coordFormatListeners.forEach(fn => fn(fmt));
}

/**
 * Creates HTML for a coordinate input row.
 */
function createCoordRow(prefix, type) {
    const fmt = SafeStorage.getItem(STORAGE_KEYS.COORD_FMT) || 'DD';
    const labelPrefix = type === 'lat' ? 'Latitude' : 'Longitude';
    let html = `<div class="coord-row" data-prefix="${prefix}" data-type="${type}" role="group" aria-label="${labelPrefix} input">`;

    // Hemisphere Select
    const hemLabel = type === 'lat' ? 'Latitude hemisphere' : 'Longitude hemisphere';
    html += `<select class="hem-select coord-input" name="${prefix}_${type}_hem" data-part="h" aria-label="${hemLabel}">`;
    if (type === 'lat') html += `<option value="1">N</option><option value="-1">S</option>`;
    else html += `<option value="1">E</option><option value="-1">W</option>`;
    html += `</select>`;

    // Deg / Min / Sec Config
    const isLat = (type === 'lat');
    const maxDeg = isLat ? 90 : 180;

    const getAttrs = (part, max, step, label) => {
        return `type="number" class="num-input coord-input" name="${prefix}_${type}_${part}" data-part="${part}" 
                inputmode="decimal" min="0" max="${max}" step="${step}" aria-label="${label}"`;
    };

    // Degrees
    const dStep = (fmt === 'DD') ? "any" : "1";
    const degLabel = `${labelPrefix} degrees`;
    html += `<input ${getAttrs('d', maxDeg, dStep, degLabel)} placeholder="°">`;

    // Minutes
    if (fmt !== 'DD') {
        const mStep = (fmt === 'DDM') ? "any" : "1";
        const minLabel = `${labelPrefix} minutes`;
        html += `<input ${getAttrs('m', 60, mStep, minLabel)} placeholder="'">`;
    }

    // Seconds
    if (fmt === 'DMS') {
        const sStep = "any";
        const secLabel = `${labelPrefix} seconds`;
        html += `<input ${getAttrs('s', 60, sStep, secLabel)} placeholder="''">`;
    }

    html += `</div>`;
    return html;
}

/**
 * Loads coordinate values from localStorage and populates input fields.
 */
function loadCoordsFromStorage(prefix, type) {
    const ddVal = parseFloat(SafeStorage.getItem(`${prefix}_${type}_dd`));
    if (isNaN(ddVal)) return;

    const row = document.querySelector(`.coord-row[data-prefix="${prefix}"][data-type="${type}"]`);
    if (!row) return;

    const fmt = SafeStorage.getItem(STORAGE_KEYS.COORD_FMT) || 'DD';
    const absVal = Math.abs(ddVal);
    const sign = ddVal < 0 ? -1 : 1;

    // Set Hemisphere
    const hSel = row.querySelector('[data-part="h"]');
    if (hSel) hSel.value = sign;

    // Calculate parts
    let d, m = 0, s = 0;

    if (fmt === 'DD') {
        d = absVal;
    } else if (fmt === 'DDM') {
        d = Math.floor(absVal);
        m = (absVal - d) * 60;
    } else { // DMS
        d = Math.floor(absVal);
        const mFull = (absVal - d) * 60;
        m = Math.floor(mFull);
        s = (mFull - m) * 60;
    }

    // Set inputs with appropriate precision
    const setVal = (part, val) => {
        const el = row.querySelector(`[data-part="${part}"]`);
        let displayVal = val;
        if (part === 'd' && fmt === 'DD') displayVal = parseFloat(val.toFixed(6));
        if (part === 'm') displayVal = parseFloat(val.toFixed(4));
        if (part === 's') displayVal = parseFloat(val.toFixed(2));
        if (el) el.value = displayVal;
    };

    setVal('d', d);
    setVal('m', m);
    setVal('s', s);
}

/**
 * Handles input changes on coordinate fields and saves to DD storage
 */
function handleCoordInput(e) {
    const row = e.target.closest('.coord-row');
    if (!row) return;
    const prefix = row.dataset.prefix;
    const type = row.dataset.type;

    const el = e.target;
    if (el.coordTimeout) clearTimeout(el.coordTimeout);
    
    // ATSEP_CONSTANTS isn't imported here, so default to 300ms
    const debounceDelay = 300; 

    el.coordTimeout = setTimeout(() => {
        const getVal = (part) => {
            const el = row.querySelector(`[data-part="${part}"]`);
            return el ? (parseFloat(el.value) || 0) : 0;
        };

        const h = getVal('h'); // 1 or -1
        const d = getVal('d');
        const m = getVal('m');
        const s = getVal('s');

        const dd = h * (d + m / 60 + s / 3600);
        SafeStorage.setItem(`${prefix}_${type}_dd`, dd);
    }, debounceDelay);
}

/**
 * Helper to paste decimal degrees
 */
function handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;

    const row = e.target.closest('.coord-row');
    const prefix = row.dataset.prefix;
    const type = row.dataset.type;

    let val = parseFloat(text);
    if (isNaN(val)) return;

    if (val < 0) {
        const hemSelect = row.querySelector('[data-part="h"]');
        if (hemSelect) hemSelect.value = "-1";
        val = Math.abs(val);
    }
    e.target.value = val;
    handleCoordInput({target: e.target}); // trigger save manually
}

/**
 * Re-renders all coordinate inputs based on current format
 */
export function renderCoordInputs(prefixes) {
    prefixes.forEach(prefix => {
        const container = document.getElementById(prefix + '_inputs');
        if (container) {
            container.innerHTML = createCoordRow(prefix, 'lat') + createCoordRow(prefix, 'lon');
        }
        // Load values from DD storage
        loadCoordsFromStorage(prefix, 'lat');
        loadCoordsFromStorage(prefix, 'lon');
    });

    // Attach listeners
    document.querySelectorAll('.coord-input').forEach(input => {
        if (input.dataset.bound) return;
        input.dataset.bound = 'true';
        input.addEventListener('input', handleCoordInput);

        if (input.dataset.part === 'd') {
            input.addEventListener('paste', handlePaste);
        }
    });
}
