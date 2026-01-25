/**
 * UI Controller for ATSEP Toolbox
 * 
 * Centralizes DOM manipulation, event listeners, input validation,
 * and user interaction handling. All computation logic is delegated
 * to the QNH and Vincenty modules.
 * 
 * @module UI
 * @author ATSEP Toolbox
 */

const UI = (function () {

    // --- Module Scoped Constants ---

    /** Debounce delay for input saving in milliseconds */
    const DEBOUNCE_DELAY_MS = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.DEBOUNCE_DELAY_MS : 300;

    /** Easter egg reveal delay in milliseconds */
    const EASTER_EGG_DELAY_MS = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.EASTER_EGG_DELAY_MS : 10000;

    /** Conversion factors - use shared constants if available */
    const INHG_TO_HPA = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.INHG_TO_HPA : 33.86389;
    const HPA_TO_INHG = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.HPA_TO_INHG : 1 / 33.86389;
    const METERS_PER_NM = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.METERS_PER_NM : 1852;

    /** Storage keys for localStorage */
    const STORAGE_KEYS = (typeof window.STORAGE_KEYS !== 'undefined')
        ? window.STORAGE_KEYS
        : {
            ACTIVE_TAB: 'active_tab',
            COORD_FMT: 'coord_fmt',
            RANGE_UNIT: 'range_unit_type',
            DEST_UNIT: 'd_unit'
        };

    // --- Safe Storage Wrapper ---

    /**
     * Safe wrapper for localStorage operations.
     * Handles cases where localStorage is unavailable (e.g., private browsing mode).
     * @namespace
     */
    const SafeStorage = {
        /** Flag indicating if localStorage is available */
        _available: null,

        /**
         * Checks if localStorage is available
         * @returns {boolean} True if localStorage is available
         */
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

        /**
         * Safely retrieves an item from localStorage
         * @param {string} key - The key to retrieve
         * @returns {string|null} The stored value or null
         */
        getItem(key) {
            if (!this.isAvailable()) return null;
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.warn('localStorage read failed:', e);
                return null;
            }
        },

        /**
         * Safely stores an item in localStorage
         * @param {string} key - The key to store
         * @param {string} value - The value to store
         */
        setItem(key, value) {
            if (!this.isAvailable()) return;
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.warn('localStorage write failed:', e);
            }
        }
    };

    // --- Cached DOM Elements ---

    /** Cached references to frequently accessed DOM elements */
    let elements = {};

    /**
     * Initialize the UI Controller.
     * This is the main entry point called on DOMContentLoaded.
     */
    function init() {
        _cacheElements();
        _attachGlobalListeners();
        _inputRestoration();
        _initTabs();
        _updateDependentUI();
        _initEasterEgg();
    }

    /**
     * Cache frequently accessed DOM elements to avoid repeated queries.
     * @private
     */
    function _cacheElements() {
        elements = {
            coordFmt: document.getElementById('coord_fmt'),
            rangeFmtSel: document.getElementById('range_fmt_sel'),
            destFmtSel: document.getElementById('dest_fmt_sel'),
            pressureInput: document.getElementById('pressureInput'),
            pressureUnit: document.getElementById('pressureUnit'),
            correctionUnit: document.getElementById('correctionUnit'),
            resultDisplay: document.getElementById('resultDisplay'),
            rangeRes: document.getElementById('range_res'),
            destRes: document.getElementById('dest_res'),
            rangeUnitType: document.getElementById('range_unit_type'),
            destUnit: document.getElementById('d_unit'),
            distInput: document.getElementById('d_dist'),
            brngInput: document.getElementById('d_brng')
        };
    }

    /**
     * Initialize the Easter egg feature.
     * The ducky mascot appears after holding the title for a set duration.
     * @private
     */
    function _initEasterEgg() {
        const titles = document.querySelectorAll('.app-title');
        const ducky = document.querySelector('.ducky-mascot');
        let timer;

        const start = () => {
            timer = setTimeout(() => {
                if (ducky) ducky.classList.add('visible');
            }, EASTER_EGG_DELAY_MS);
        };

        const cancel = () => {
            clearTimeout(timer);
        };

        titles.forEach(t => {
            t.addEventListener('mousedown', start);
            t.addEventListener('touchstart', start);
            t.addEventListener('mouseup', cancel);
            t.addEventListener('mouseleave', cancel);
            t.addEventListener('touchend', cancel);
        });
    }

    /**
     * Attach all event listeners.
     * Centralizes event binding - no onclick/onchange needed in HTML.
     * @private
     */
    function _attachGlobalListeners() {
        // Tab Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => _switchTab(e.currentTarget));
        });

        // Coordinate Format Selection
        const fmtSelectors = ['coord_fmt', 'range_fmt_sel', 'dest_fmt_sel'];
        fmtSelectors.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => _updateFmt(e.target.value));
        });

        // Unit Selection
        const unitSelectors = ['range_unit_type', 'd_unit'];
        unitSelectors.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => _updateDistUnit(e.target.value));
        });

        // Swap Button
        const swapBtn = document.getElementById('swapRangeBtn');
        if (swapBtn) swapBtn.addEventListener('click', _swapRangeInputs);

        // Input Savings (Auto-save) with debouncing
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('save-val') && e.target.id) {
                const el = e.target;
                if (el.saveTimeout) clearTimeout(el.saveTimeout);
                el.saveTimeout = setTimeout(() => {
                    SafeStorage.setItem(el.id, el.value);
                }, DEBOUNCE_DELAY_MS);
            }
        });

        // QNH Module Listeners
        const qnhBtn = document.getElementById('calculateButton');
        if (qnhBtn) qnhBtn.addEventListener('click', _calculateQnhCorrectionUI);

        if (elements.pressureInput) {
            elements.pressureInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    _calculateQnhCorrectionUI();
                }
            });
        }

        if (elements.pressureUnit) {
            elements.pressureUnit.dataset.prev = elements.pressureUnit.value;
            elements.pressureUnit.addEventListener('change', _handlePressureUnitChange);
            _updatePressureInputAttributes();
        }

        // Vincenty Module Listeners
        const rangeBtn = document.querySelector('#range-panel .calculate-btn');
        if (rangeBtn) rangeBtn.addEventListener('click', _runRange);

        const destBtn = document.querySelector('#dest-panel .calculate-btn');
        if (destBtn) destBtn.addEventListener('click', _runDest);

        // Copy Buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.getAttribute('data-target');
                _copyResult(targetId);
            });
        });
    }

    // --- Tab Logic ---

    /**
     * Initialize tab state from saved preference or default.
     * @private
     */
    function _initTabs() {
        const lastTabId = SafeStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'qnh-panel';
        const btn = document.querySelector(`.tab-btn[data-tab="${lastTabId}"]`) || document.querySelector('.tab-btn');
        if (btn) _switchTab(btn);
    }

    /**
     * Switches the active tab in the UI.
     * @param {HTMLElement} targetBtn - The tab button that was clicked
     * @private
     */
    function _switchTab(targetBtn) {
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

    // --- Input & State Management ---

    /**
     * Restore saved input values from localStorage.
     * @private
     */
    function _inputRestoration() {
        document.querySelectorAll('.save-val').forEach(el => {
            const saved = SafeStorage.getItem(el.id);
            if (saved !== null) el.value = saved;
        });
    }

    /**
     * Update coordinate format across all selectors.
     * @param {string} val - The format value ('DD', 'DDM', 'DMS')
     * @private
     */
    function _updateFmt(val) {
        // Sync all selectors
        document.querySelectorAll('#coord_fmt, #range_fmt_sel, #dest_fmt_sel').forEach(el => {
            el.value = val;
        });

        SafeStorage.setItem(STORAGE_KEYS.COORD_FMT, val);
        SafeStorage.setItem('range_fmt_sel', val);
        SafeStorage.setItem('dest_fmt_sel', val);

        _updateDependentUI();
    }

    /**
     * Update distance unit across all selectors.
     * @param {string} val - The unit value ('NM' or 'M')
     * @private
     */
    function _updateDistUnit(val) {
        document.querySelectorAll('#range_unit_type, #d_unit').forEach(el => {
            el.value = val;
        });
        SafeStorage.setItem(STORAGE_KEYS.RANGE_UNIT, val);
        SafeStorage.setItem(STORAGE_KEYS.DEST_UNIT, val);
    }

    /**
     * Update UI elements that depend on format/unit settings.
     * Re-renders coordinate input fields based on current format.
     * @private
     */
    function _updateDependentUI() {
        // Re-render coordinate inputs based on format
        ['r_origin', 'r_dest', 'd_start'].forEach(prefix => {
            const container = document.getElementById(prefix + '_inputs');
            if (container) {
                container.innerHTML = _createCoordRow(prefix, 'lat') + _createCoordRow(prefix, 'lon');
            }
            // Load values from DD storage
            _loadCoordsFromStorage(prefix, 'lat');
            _loadCoordsFromStorage(prefix, 'lon');
        });

        // Attach listeners to the newly created inputs
        _attachCoordListeners();

        // Restore other inputs
        _inputRestoration();
    }

    /**
     * Creates HTML for a coordinate input row.
     * @param {string} prefix - Input group prefix (e.g., 'r_origin', 'd_start')
     * @param {string} type - Coordinate type ('lat' or 'lon')
     * @returns {string} HTML string for the coordinate row
     * @private
     */
    function _createCoordRow(prefix, type) {
        const fmt = (elements.coordFmt ? elements.coordFmt.value : null) || 'DD';
        const labelPrefix = type === 'lat' ? 'Latitude' : 'Longitude';
        let html = `<div class="coord-row" data-prefix="${prefix}" data-type="${type}" role="group" aria-label="${labelPrefix} input">`;

        // Hemisphere Select
        const hemLabel = type === 'lat' ? 'Latitude hemisphere' : 'Longitude hemisphere';
        html += `<select class="hem-select coord-input" data-part="h" aria-label="${hemLabel}">`;
        if (type === 'lat') html += `<option value="1">N</option><option value="-1">S</option>`;
        else html += `<option value="1">E</option><option value="-1">W</option>`;
        html += `</select>`;

        // Deg / Min / Sec Config
        const isLat = (type === 'lat');
        const maxDeg = isLat ? 90 : 180;

        // Helper for input attributes
        const getAttrs = (part, max, step, label) => {
            return `type="number" class="num-input coord-input" data-part="${part}" 
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
     * Copies result text to clipboard.
     * @param {string} elementId - ID of the element containing text to copy
     * @private
     */
    function _copyResult(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            navigator.clipboard.writeText(el.innerText)
                .catch(err => console.error('Copy failed', err));
        }
    }

    // --- Coordinate Management ---

    /**
     * Attach event listeners to coordinate input fields.
     * @private
     */
    function _attachCoordListeners() {
        document.querySelectorAll('.coord-input').forEach(input => {
            // Avoid double binding
            if (input.dataset.bound) return;
            input.dataset.bound = 'true';

            input.addEventListener('input', _handleCoordInput);

            // Paste handling for degrees
            if (input.dataset.part === 'd') {
                input.addEventListener('paste', _handlePaste);
            }
        });
    }

    /**
     * Handles paste events on degree inputs.
     * Supports pasting decimal degrees with automatic hemisphere detection.
     * @param {ClipboardEvent} e - The paste event
     * @private
     */
    function _handlePaste(e) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (!text) return;

        const row = e.target.closest('.coord-row');
        const prefix = row.dataset.prefix;
        const type = row.dataset.type;

        let val = parseFloat(text);
        if (isNaN(val)) return;

        // If negative, set sign to -1 (S/W) and use abs value
        if (val < 0) {
            const hemSelect = row.querySelector('[data-part="h"]');
            if (hemSelect) hemSelect.value = "-1";
            val = Math.abs(val);
        }

        // Set the degree input value
        e.target.value = val;

        // Trigger save
        _saveCoordsToStorage(prefix, type);
    }

    /**
     * Handles input changes on coordinate fields.
     * Debounces saving to reduce disk I/O.
     * @param {Event} e - The input event
     * @private
     */
    function _handleCoordInput(e) {
        const row = e.target.closest('.coord-row');
        if (!row) return;
        const prefix = row.dataset.prefix;
        const type = row.dataset.type;

        const el = e.target;
        if (el.coordTimeout) clearTimeout(el.coordTimeout);
        el.coordTimeout = setTimeout(() => {
            _saveCoordsToStorage(prefix, type);
        }, DEBOUNCE_DELAY_MS);
    }

    /**
     * Saves coordinate values to localStorage as decimal degrees.
     * Converts from current format (DD/DDM/DMS) to DD for storage.
     * @param {string} prefix - Input group prefix
     * @param {string} type - Coordinate type ('lat' or 'lon')
     * @private
     */
    function _saveCoordsToStorage(prefix, type) {
        const row = document.querySelector(`.coord-row[data-prefix="${prefix}"][data-type="${type}"]`);
        if (!row) return;

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
    }

    /**
     * Loads coordinate values from localStorage and populates input fields.
     * Converts from stored DD to current display format (DD/DDM/DMS).
     * @param {string} prefix - Input group prefix
     * @param {string} type - Coordinate type ('lat' or 'lon')
     * @private
     */
    function _loadCoordsFromStorage(prefix, type) {
        const ddVal = parseFloat(SafeStorage.getItem(`${prefix}_${type}_dd`));
        if (isNaN(ddVal)) return;

        const row = document.querySelector(`.coord-row[data-prefix="${prefix}"][data-type="${type}"]`);
        if (!row) return;

        const fmt = (elements.coordFmt ? elements.coordFmt.value : null) || 'DD';
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
     * Swaps the origin and destination coordinates in the Range panel.
     * @private
     */
    function _swapRangeInputs() {
        const p1Lat = SafeStorage.getItem('r_origin_lat_dd');
        const p1Lon = SafeStorage.getItem('r_origin_lon_dd');
        const p2Lat = SafeStorage.getItem('r_dest_lat_dd');
        const p2Lon = SafeStorage.getItem('r_dest_lon_dd');

        SafeStorage.setItem('r_origin_lat_dd', p2Lat || 0);
        SafeStorage.setItem('r_origin_lon_dd', p2Lon || 0);
        SafeStorage.setItem('r_dest_lat_dd', p1Lat || 0);
        SafeStorage.setItem('r_dest_lon_dd', p1Lon || 0);

        // Reload UI
        _updateDependentUI();
    }

    // --- QNH Logic ---

    /**
     * Handles pressure unit change with value conversion.
     * @param {Event} e - The change event
     * @private
     */
    function _handlePressureUnitChange(e) {
        const el = e.target;
        const newUnit = el.value;
        const oldUnit = el.dataset.prev;
        const input = elements.pressureInput;

        if (input.value && oldUnit && newUnit !== oldUnit) {
            let val = parseFloat(input.value);
            if (!isNaN(val)) {
                if (newUnit === 'inHg' && oldUnit === 'hPa') {
                    // hPa -> inHg
                    val = val * HPA_TO_INHG;
                    input.value = val.toFixed(2);
                } else if (newUnit === 'hPa' && oldUnit === 'inHg') {
                    // inHg -> hPa
                    val = val * INHG_TO_HPA;
                    input.value = Math.round(val);
                }
            }
        }

        el.dataset.prev = newUnit;
        _updatePressureInputAttributes();
    }

    /**
     * Updates pressure input attributes based on selected unit.
     * @private
     */
    function _updatePressureInputAttributes() {
        const unit = elements.pressureUnit ? elements.pressureUnit.value : 'hPa';
        const input = elements.pressureInput;
        if (!input) return;

        if (unit === 'inHg') {
            input.step = "0.01";
            input.placeholder = "e.g., 29.92";
        } else {
            input.step = "1";
            input.placeholder = "e.g., 1013";
        }
    }

    /**
     * Calculates and displays QNH correction.
     * Handles UI feedback including errors and warnings.
     * @private
     */
    function _calculateQnhCorrectionUI() {
        const inputRaw = parseFloat(elements.pressureInput ? elements.pressureInput.value : 0);
        const pUnit = elements.pressureUnit ? elements.pressureUnit.value : 'hPa';
        const outUnit = elements.correctionUnit ? elements.correctionUnit.value : 'feet';
        const display = elements.resultDisplay;

        if (!display) return;

        display.innerHTML = '';
        display.removeAttribute('data-warning');

        if (isNaN(inputRaw) || inputRaw <= 0) {
            const msg = (typeof ERROR_MESSAGES !== 'undefined')
                ? ERROR_MESSAGES.INVALID_PRESSURE
                : 'Please enter a valid positive pressure value.';
            display.innerHTML = `<span class="result-error">${msg}</span>`;
            return;
        }

        const res = QNH.calculate(inputRaw, pUnit, outUnit);

        if (res.error) {
            display.innerHTML = `<span class="result-error">⚠️ ${res.msg}</span>`;
            return;
        }

        let html = '';
        if (res.warning) {
            html += `<span class="warning-text">⚠️ Warning: Abnormal pressure range.</span>`;
            display.setAttribute('data-warning', 'true');
        }

        const colorClass = res.correction > 0 ? 'result-positive' : (res.correction < 0 ? 'result-negative' : '');
        const prefix = res.correction > 0 ? '+' : '';

        html += `<span class="pa-value" style="display:block; margin-bottom: 4px;">Pressure Altitude: ${res.pressureAltitude} ${res.unit}</span>`;
        html += `<span class="correction-value ${colorClass}" style="opacity: 0.9; font-size: 0.9em;">(Correction: ${prefix}${res.correction} ${res.unit})</span>`;

        display.innerHTML = html;
    }

    // --- Vincenty Helpers ---

    /**
     * Validates coordinate inputs and returns decimal degrees.
     * @param {string} prefix - The input group prefix (e.g., 'r_origin', 'd_start')
     * @param {string} errorContainerId - ID of the element to display errors
     * @returns {Object|null} Object with lat/lon properties, or null if validation fails
     * @private
     */
    function _validateAndGetCoords(prefix, errorContainerId) {
        const getDD = (type, max, name) => {
            const val = parseFloat(SafeStorage.getItem(`${prefix}_${type}_dd`));

            if (isNaN(val)) {
                return { err: `${name}: Invalid number` };
            }
            if (Math.abs(val) > max) {
                return { err: `${name}: Must be ≤ ${max}°` };
            }
            return { val };
        };

        const latObj = getDD('lat', 90, 'Lat');
        const lonObj = getDD('lon', 180, 'Lon');

        if (latObj.err || lonObj.err) {
            const errDiv = document.getElementById(errorContainerId);
            const msg = latObj.err || lonObj.err;
            errDiv.innerHTML = `<span class="result-error">⚠️ ${msg}</span>`;
            return null;
        }

        return { lat: latObj.val, lon: lonObj.val };
    }

    /**
     * Formats coordinates for display based on current format setting.
     * @param {number} lat - Latitude in decimal degrees
     * @param {number} lon - Longitude in decimal degrees
     * @returns {string} HTML string with formatted coordinates
     * @private
     */
    function _formatCoords(lat, lon) {
        const fmt = elements.coordFmt ? elements.coordFmt.value : 'DD';

        const formatSingle = (val, isLat) => {
            const abs = Math.abs(val);
            const deg = Math.floor(abs);
            const hemi = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');

            if (fmt === 'DD') return `${hemi} ${abs.toFixed(5)}°`;

            const minFull = (abs - deg) * 60;
            if (fmt === 'DDM') return `${hemi} ${deg}° ${minFull.toFixed(4)}'`;

            const min = Math.floor(minFull);
            const sec = ((minFull - min) * 60).toFixed(2);
            return `${hemi} ${deg}° ${min}' ${sec}"`;
        };

        return `<span class="coord-val">${formatSingle(lat, true)}</span><span class="coord-val">${formatSingle(lon, false)}</span>`;
    }

    // --- Vincenty Calculation ---

    /**
     * Runs the Range (inverse) calculation.
     * Calculates distance and bearing between two points.
     * @private
     */
    function _runRange() {
        const p1 = _validateAndGetCoords('r_origin', 'range_res');
        const p2 = _validateAndGetCoords('r_dest', 'range_res');

        if (!p1 || !p2) return;

        try {
            const res = Vincenty.calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
            const unit = elements.rangeUnitType ? elements.rangeUnitType.value : 'NM';

            let distDisplay = res.distance;
            if (unit === 'NM') distDisplay = res.distance / METERS_PER_NM;

            const html = `
                <div class="result-row"><span class="label">Range:</span> <span class="val">${distDisplay.toFixed(2)} ${unit}</span></div>
                <div class="result-row"><span class="label">Bearing:</span> <span class="val">${Math.round(res.initialBearing)}° (T)</span></div>
            `;
            elements.rangeRes.innerHTML = html;
        } catch (e) {
            elements.rangeRes.innerHTML = `<span class="result-error">Error: ${e.message}</span>`;
        }
    }

    /**
     * Runs the Destination (direct) calculation.
     * Projects a point given start, distance, and bearing.
     * @private
     */
    function _runDest() {
        const start = _validateAndGetCoords('d_start', 'dest_res');
        if (!start) return;

        const distEl = elements.distInput;
        const brngEl = elements.brngInput;

        if (!distEl || !brngEl) return;

        const dist = parseFloat(distEl.value);
        const brng = parseFloat(brngEl.value);

        if (isNaN(dist) || isNaN(brng)) {
            elements.destRes.innerHTML = '<span class="result-error">Invalid Range or Bearing</span>';
            return;
        }

        if (dist < 0) {
            const msg = (typeof ERROR_MESSAGES !== 'undefined')
                ? ERROR_MESSAGES.NEGATIVE_RANGE
                : 'Range cannot be negative';
            elements.destRes.innerHTML = `<span class="result-error">${msg}</span>`;
            return;
        }

        if (brng < -360 || brng > 360) {
            const msg = (typeof ERROR_MESSAGES !== 'undefined')
                ? ERROR_MESSAGES.INVALID_BEARING
                : 'Bearing must be between -360° and +360°';
            elements.destRes.innerHTML = `<span class="result-error">${msg}</span>`;
            return;
        }

        const unit = elements.destUnit ? elements.destUnit.value : 'NM';
        const distMeters = (unit === 'NM') ? dist * METERS_PER_NM : dist;

        try {
            const dest = Vincenty.calculateDestination(start.lat, start.lon, distMeters, brng);
            elements.destRes.innerHTML = `<span class="result-success">${_formatCoords(dest.lat, dest.lon)}</span>`;
        } catch (e) {
            elements.destRes.innerHTML = `<span class="result-error">Error: ${e.message}</span>`;
        }
    }

    // Public API
    return {
        init
    };

})();

// Auto-start on DOMContentLoaded
document.addEventListener('DOMContentLoaded', UI.init);
