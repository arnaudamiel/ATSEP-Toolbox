/**
 * UI Controller for ATSEP Toolbox
 * Centralizes DOM manipulation, event listeners, and input validation.
 */

const UI = (function () {

    // --- Module Scoped Constants ---
    const STORAGE_KEYS = {
        ACTIVE_TAB: 'active_tab',
        COORD_FMT: 'coord_fmt',
        RANGE_UNIT: 'range_unit_type',
        DEST_UNIT: 'd_unit'
    };

    const INHG_TO_HPA = 33.86389; // Standard conversion factor

    const CONVERSION_FACTORS = {
        INHG_TO_HPA: INHG_TO_HPA,
        HPA_TO_INHG: 1 / INHG_TO_HPA,
        METERS_PER_NM: 1852
    };

    /**
     * Initialize the UI Controller
     */
    function init() {
        console.log('UI Controller Initializing...');
        _attachGlobalListeners();
        _inputRestoration();
        _initTabs();
        _updateDependentUI();
        _initEasterEgg();
    }

    function _initEasterEgg() {
        const titles = document.querySelectorAll('.app-title');
        const ducky = document.querySelector('.ducky-mascot');
        let timer;

        const start = () => {
            timer = setTimeout(() => {
                if (ducky) ducky.classList.add('visible');
            }, 10000); // 10 seconds
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
     * Attach all event listeners here.
     * Removes the need for onclick/onchange in HTML.
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

        // Input Savings (Auto-save) for non-coordinate inputs
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('save-val') && e.target.id) {
                const el = e.target;
                if (el.saveTimeout) clearTimeout(el.saveTimeout);
                el.saveTimeout = setTimeout(() => {
                    localStorage.setItem(el.id, el.value);
                }, 300);
            }
        });

        // QNH Module Listeners
        const qnhBtn = document.getElementById('calculateButton');
        if (qnhBtn) qnhBtn.addEventListener('click', _calculateQnhCorrectionUI);

        const pressureInput = document.getElementById('pressureInput');
        if (pressureInput) {
            pressureInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    _calculateQnhCorrectionUI();
                }
            });
        }

        const pressureUnit = document.getElementById('pressureUnit');
        if (pressureUnit) {
            pressureUnit.dataset.prev = pressureUnit.value;
            pressureUnit.addEventListener('change', _handlePressureUnitChange);
            _updatePressureInputAttributes(); // Run once on init
        }


        // Vicenty Module Listeners
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

    function _initTabs() {
        const lastTabId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'qnh-panel';
        // Find button for this tab
        const btn = document.querySelector(`.tab-btn[data-tab="${lastTabId}"]`) || document.querySelector('.tab-btn');
        if (btn) _switchTab(btn);
    }

    function _switchTab(targetBtn) {
        // Deactivate all
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        // Activate target
        targetBtn.classList.add('active');
        const panelId = targetBtn.getAttribute('data-tab');
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.add('active');

        localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, panelId);
    }

    // --- Input & State Management ---

    function _inputRestoration() {
        document.querySelectorAll('.save-val').forEach(el => {
            const saved = localStorage.getItem(el.id);
            if (saved !== null) el.value = saved;
        });
        // Coords are handled separately now
    }

    function _updateFmt(val) {
        // Sync all selectors
        document.querySelectorAll('#coord_fmt, #range_fmt_sel, #dest_fmt_sel').forEach(el => {
            el.value = val;
        });

        localStorage.setItem(STORAGE_KEYS.COORD_FMT, val);
        localStorage.setItem('range_fmt_sel', val);
        localStorage.setItem('dest_fmt_sel', val);

        _updateDependentUI();
    }

    function _updateDistUnit(val) {
        document.querySelectorAll('#range_unit_type, #d_unit').forEach(el => {
            el.value = val;
        });
        localStorage.setItem(STORAGE_KEYS.RANGE_UNIT, val);
        localStorage.setItem(STORAGE_KEYS.DEST_UNIT, val);
    }

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

    function _createCoordRow(prefix, type) {
        const fmt = document.getElementById('coord_fmt').value || 'DD';
        let html = `<div class="coord-row" data-prefix="${prefix}" data-type="${type}">`;

        // Hemisphere Select
        html += `<select class="hem-select coord-input" data-part="h">`;
        if (type === 'lat') html += `<option value="1">N</option><option value="-1">S</option>`;
        else html += `<option value="1">E</option><option value="-1">W</option>`;
        html += `</select>`;

        // Deg / Min / Sec Config
        const isLat = (type === 'lat');
        const maxDeg = isLat ? 90 : 180;

        // Helper for input attributes
        const getAttrs = (part, max, step) => {
            return `type="number" class="num-input coord-input" data-part="${part}" 
                    inputmode="decimal" min="0" max="${max}" step="${step}"`;
        };

        // Degrees
        const dStep = (fmt === 'DD') ? "any" : "1";
        // For DD, max is maxDeg. For DMS/DDM, technically maxDeg too (e.g. 90deg 0min). 
        // Validation should allow 90 if others are 0, but HTML max=90 works.
        html += `<input ${getAttrs('d', maxDeg, dStep)} placeholder="°">`;

        // Minutes
        if (fmt !== 'DD') {
            const mStep = (fmt === 'DDM') ? "any" : "1";
            // Minutes max is always < 60 (except if degrees < max? No, standard is 0-59).
            // Let's use 60 as max for safety, but step suggests integer vs decimal
            html += `<input ${getAttrs('m', 60, mStep)} placeholder="'">`;
        }

        // Seconds
        if (fmt === 'DMS') {
            const sStep = "any";
            html += `<input ${getAttrs('s', 60, sStep)} placeholder="''">`;
        }

        html += `</div>`;
        return html;
    }

    function _copyResult(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            navigator.clipboard.writeText(el.innerText)
                .catch(err => console.error('Copy failed', err));
        }
    }

    // --- Logic: Coordinate Management ---

    function _attachCoordListeners() {
        document.querySelectorAll('.coord-input').forEach(input => {
            // Avoid double binding
            if (input.dataset.bound) return;
            input.dataset.bound = true;

            input.addEventListener('input', _handleCoordInput);

            // Paste handling for degrees
            if (input.dataset.part === 'd') {
                input.addEventListener('paste', _handlePaste);
            }
        });
    }

    function _handlePaste(e) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        if (!text) return;

        const row = e.target.closest('.coord-row');
        const prefix = row.dataset.prefix; // e.g., r_origin
        const type = row.dataset.type;     // e.g., lat

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

    function _handleCoordInput(e) {
        const row = e.target.closest('.coord-row');
        if (!row) return;
        const prefix = row.dataset.prefix;
        const type = row.dataset.type;

        const el = e.target;
        if (el.coordTimeout) clearTimeout(el.coordTimeout);
        el.coordTimeout = setTimeout(() => {
            _saveCoordsToStorage(prefix, type);
        }, 300);
    }

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
        localStorage.setItem(`${prefix}_${type}_dd`, dd);
    }

    function _loadCoordsFromStorage(prefix, type) {
        const ddVal = parseFloat(localStorage.getItem(`${prefix}_${type}_dd`));
        if (isNaN(ddVal)) return; // No saved data

        const row = document.querySelector(`.coord-row[data-prefix="${prefix}"][data-type="${type}"]`);
        if (!row) return;

        const fmt = document.getElementById('coord_fmt').value || 'DD';
        const absVal = Math.abs(ddVal);
        const sign = ddVal < 0 ? -1 : 1;

        // Set Hemisphere
        const hSel = row.querySelector('[data-part="h"]');
        if (hSel) hSel.value = sign;

        // Calculate parts
        let d, m = 0, s = 0;

        if (fmt === 'DD') {
            d = absVal; // Keep high precision? 
            // Display might limit decimals, but value should be exact
        } else if (fmt === 'DDM') {
            d = Math.floor(absVal);
            m = (absVal - d) * 60;
        } else { // DMS
            d = Math.floor(absVal);
            const mFull = (absVal - d) * 60;
            m = Math.floor(mFull);
            s = (mFull - m) * 60;
        }

        // Set inputs
        const setVal = (part, val) => {
            const el = row.querySelector(`[data-part="${part}"]`);
            // Format to reasonable decimals to avoid floating point ugliness
            // DD: 6, DDM: 4, DMS: 2
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

    function _swapRangeInputs() {
        const p1Lat = localStorage.getItem('r_origin_lat_dd');
        const p1Lon = localStorage.getItem('r_origin_lon_dd');
        const p2Lat = localStorage.getItem('r_dest_lat_dd');
        const p2Lon = localStorage.getItem('r_dest_lon_dd');

        localStorage.setItem('r_origin_lat_dd', p2Lat || 0);
        localStorage.setItem('r_origin_lon_dd', p2Lon || 0);
        localStorage.setItem('r_dest_lat_dd', p1Lat || 0);
        localStorage.setItem('r_dest_lon_dd', p1Lon || 0);

        // Reload UI
        _updateDependentUI();
    }

    // --- Logic: QNH ---

    function _handlePressureUnitChange(e) {
        const el = e.target;
        const newUnit = el.value;
        const oldUnit = el.dataset.prev;
        const input = document.getElementById('pressureInput');

        if (input.value && oldUnit && newUnit !== oldUnit) {
            let val = parseFloat(input.value);
            if (!isNaN(val)) {
                if (newUnit === 'inHg' && oldUnit === 'hPa') {
                    // hPa -> inHg
                    val = val * CONVERSION_FACTORS.HPA_TO_INHG;
                    input.value = val.toFixed(2);
                } else if (newUnit === 'hPa' && oldUnit === 'inHg') {
                    // inHg -> hPa
                    val = val * CONVERSION_FACTORS.INHG_TO_HPA;
                    input.value = Math.round(val);
                }
            }
        }

        el.dataset.prev = newUnit;
        _updatePressureInputAttributes();
    }

    function _updatePressureInputAttributes() {
        const unit = document.getElementById('pressureUnit').value;
        const input = document.getElementById('pressureInput');
        if (unit === 'inHg') {
            input.step = "0.01";
            input.placeholder = "e.g., 29.92";
        } else {
            input.step = "1";
            input.placeholder = "e.g., 1013";
        }
    }

    function _calculateQnhCorrectionUI() {
        const inputRaw = parseFloat(document.getElementById('pressureInput').value);
        const pUnit = document.getElementById('pressureUnit').value;
        const outUnit = document.getElementById('correctionUnit').value;
        const display = document.getElementById('resultDisplay');

        display.innerHTML = '';
        display.removeAttribute('data-warning');

        if (isNaN(inputRaw) || inputRaw <= 0) {
            display.innerHTML = '<span class="result-error">Please enter a valid positive pressure value.</span>';
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

        // Format: Pressure Altitude: 360 ft (Correction: -360 ft)
        html += `<span class="pa-value" style="display:block; margin-bottom: 4px;">Pressure Altitude: ${res.pressureAltitude} ${res.unit}</span>`;
        html += `<span class="correction-value ${colorClass}" style="opacity: 0.9; font-size: 0.9em;">(Correction: ${prefix}${res.correction} ${res.unit})</span>`;

        display.innerHTML = html;
    }

    // --- Logic: Vicenty Helpers ---

    function _validateAndGetCoords(prefix, errorContainerId) {
        const getDD = (type, max, name) => {
            const val = parseFloat(localStorage.getItem(`${prefix}_${type}_dd`));

            // Check for NaN (should be handled by save logic, but good safety)
            if (isNaN(val)) {
                return { err: `${name}: Invalid number` };
            }
            // Simple range check
            if (Math.abs(val) > max) {
                return { err: `${name}: Must be <= ${max}°` };
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

    function _formatCoords(lat, lon) {
        const fmt = document.getElementById('coord_fmt').value;

        const formatSingle = (val, isLat) => {
            const abs = Math.abs(val);
            const deg = Math.floor(abs);
            const hemi = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');

            if (fmt === 'DD') return `${hemi} ${abs.toFixed(5)}°`;

            const minFull = (abs - deg) * 60;
            if (fmt === 'DDM') return `${hemi} ${deg}° ${minFull.toFixed(5)}'`;

            const min = Math.floor(minFull);
            const sec = ((minFull - min) * 60).toFixed(2);
            return `${hemi} ${deg}° ${min}' ${sec}"`;
        };

        // Return HTML with wrappers to control line breaking
        return `<span class="coord-val">${formatSingle(lat, true)}</span><span class="coord-val">${formatSingle(lon, false)}</span>`;
    }

    // --- Logic: Vicenty Calculation ---

    function _runRange() {
        const p1 = _validateAndGetCoords('r_origin', 'range_res');
        const p2 = _validateAndGetCoords('r_dest', 'range_res');

        if (!p1 || !p2) return;

        try {
            const res = Vicenty.calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
            const unit = document.getElementById('range_unit_type').value;

            let distDisplay = res.distance;
            if (unit === 'NM') distDisplay = res.distance / CONVERSION_FACTORS.METERS_PER_NM;

            const html = `
                <div class="result-row"><span class="label">Range:</span> <span class="val">${distDisplay.toFixed(2)} ${unit}</span></div>
                <div class="result-row"><span class="label">Bearing:</span> <span class="val">${Math.round(res.initialBearing)}° (T)</span></div>
            `;
            document.getElementById('range_res').innerHTML = html;
        } catch (e) {
            document.getElementById('range_res').innerHTML = `<span class="result-error">Error: ${e.message}</span>`;
        }
    }

    function _runDest() {
        const start = _validateAndGetCoords('d_start', 'dest_res');
        if (!start) return;

        const distEl = document.getElementById('d_dist');
        const brngEl = document.getElementById('d_brng');

        const dist = parseFloat(distEl.value);
        const brng = parseFloat(brngEl.value);

        if (isNaN(dist) || isNaN(brng)) {
            document.getElementById('dest_res').innerHTML = '<span class="result-error">Invalid Range or Bearing</span>';
            return;
        }

        if (dist < 0) {
            document.getElementById('dest_res').innerHTML = '<span class="result-error">Range cannot be negative</span>';
            return;
        }

        if (brng < -360 || brng > 360) {
            document.getElementById('dest_res').innerHTML = '<span class="result-error">Bearing must be between -360 and 360</span>';
            return;
        }

        const unit = document.getElementById('d_unit').value;
        const distMeters = (unit === 'NM') ? dist * CONVERSION_FACTORS.METERS_PER_NM : dist;

        try {
            const dest = Vicenty.calculateDestination(start.lat, start.lon, distMeters, brng);
            document.getElementById('dest_res').innerHTML = `<span class="result-success">${_formatCoords(dest.lat, dest.lon)}</span>`;
        } catch (e) {
            document.getElementById('dest_res').innerHTML = `<span class="result-error">Error: ${e.message}</span>`;
        }
    }

    // Public API
    return {
        init
    };

})();

// Auto-start
document.addEventListener('DOMContentLoaded', UI.init);
