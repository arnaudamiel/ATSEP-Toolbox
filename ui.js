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

        // Input Savings (Auto-save)
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('save-val') && e.target.id) {
                localStorage.setItem(e.target.id, e.target.value);
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
            pressureUnit.addEventListener('change', _updatePressureInputAttributes);
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
    }

    function _updateFmt(val) {
        // Sync all selectors
        document.querySelectorAll('#coord_fmt, #range_fmt_sel, #dest_fmt_sel').forEach(el => {
            el.value = val;
        });

        // Clear hidden inputs to avoid ghost data
        const inputsToClear = ['_m', '_s'];
        const prefixes = ['r_origin_lat', 'r_origin_lon', 'r_dest_lat', 'r_dest_lon', 'd_start_lat', 'd_start_lon'];

        prefixes.forEach(p => {
            if (val === 'DD') {
                inputsToClear.forEach(sfx => localStorage.setItem(p + sfx, '0'));
            } else if (val === 'DDM') {
                localStorage.setItem(p + '_s', '0');
            }
        });

        localStorage.setItem(STORAGE_KEYS.COORD_FMT, val);
        localStorage.setItem('range_fmt_sel', val); // Legacy support if needed
        localStorage.setItem('dest_fmt_sel', val);  // Legacy support if needed

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
        });
        // Restore values for newly created inputs
        _inputRestoration();
    }

    function _createCoordRow(prefix, type) {
        const fmt = document.getElementById('coord_fmt').value || 'DD';
        let html = `<div class="coord-row">`;

        // Hemisphere Select
        html += `<select id="${prefix}_${type}_h" class="hem-select save-val">`;
        if (type === 'lat') html += `<option value="1">N</option><option value="-1">S</option>`;
        else html += `<option value="1">E</option><option value="-1">W</option>`;
        html += `</select>`;

        // Degrees
        html += `<input type="number" id="${prefix}_${type}_d" class="num-input save-val" placeholder="°">`;

        // Minutes
        if (fmt !== 'DD') {
            html += `<input type="number" id="${prefix}_${type}_m" class="num-input save-val" placeholder="'">`;
        }

        // Seconds
        if (fmt === 'DMS') {
            html += `<input type="number" id="${prefix}_${type}_s" class="num-input save-val" placeholder="''">`;
        }

        html += `</div>`;
        return html;
    }

    function _copyResult(elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            navigator.clipboard.writeText(el.innerText)
                .then(() => {
                    // Optional: Visual feedback
                    const originalText = el.innerText;
                    // el.innerText = "Copied!";
                    // setTimeout(() => el.innerText = originalText, 1000);
                })
                .catch(err => console.error('Copy failed', err));
        }
    }

    // --- Logic: QNH ---

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

        html += `<span class="correction-value ${colorClass}">Correction: ${prefix}${res.correction} ${res.unit}</span>`;
        display.innerHTML = html;
    }

    // --- Logic: Vicenty Helpers ---

    function _validateAndGetCoords(prefix, errorContainerId) {
        const fmt = document.getElementById('coord_fmt').value;
        const errors = [];

        const getVal = (id, max, fieldName) => {
            const el = document.getElementById(id);
            if (!el) return 0;
            el.classList.remove('invalid');
            const v = parseFloat(el.value);
            if (isNaN(v) || v < 0) {
                el.classList.add('invalid');
                errors.push(`${fieldName}: Invalid number`);
                return -1;
            }
            if (v >= max) { // Simple check, exact limits logic can be more complex if needed
                el.classList.add('invalid');
                errors.push(`${fieldName}: Must be < ${max}`);
                return -1;
            }
            return v;
        };

        const hLat = parseFloat(document.getElementById(`${prefix}_lat_h`).value);
        const hLon = parseFloat(document.getElementById(`${prefix}_lon_h`).value);

        // Degrees
        const dLat = getVal(`${prefix}_lat_d`, 91, 'Lat Deg'); // Allow 90 exactly? Let's say < 91 for now
        const dLon = getVal(`${prefix}_lon_d`, 181, 'Lon Deg');

        let mLat = 0, MLon = 0, sLat = 0, sLon = 0;

        if (fmt !== 'DD') {
            mLat = getVal(`${prefix}_lat_m`, 60, 'Lat Min');
            MLon = getVal(`${prefix}_lon_m`, 60, 'Lon Min');
        }
        if (fmt === 'DMS') {
            sLat = getVal(`${prefix}_lat_s`, 60, 'Lat Sec');
            sLon = getVal(`${prefix}_lon_s`, 60, 'Lon Sec');
        }

        if (errors.length > 0) {
            const errDiv = document.getElementById(errorContainerId);
            errDiv.innerHTML = `<span class="result-error">⚠️ Check inputs marked in red.</span>`;
            return null;
        }

        // Calculation
        const lat = (dLat + mLat / 60 + sLat / 3600) * hLat;
        const lon = (dLon + MLon / 60 + sLon / 3600) * hLon;

        return { lat, lon };
    }

    function _formatCoords(lat, lon) {
        const fmt = document.getElementById('coord_fmt').value;

        const formatSingle = (val, isLat) => {
            const abs = Math.abs(val);
            const deg = Math.floor(abs);
            const hemi = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');

            if (fmt === 'DD') return `${hemi} ${abs.toFixed(5)}°`;

            const minFull = (abs - deg) * 60;
            if (fmt === 'DDM') return `${hemi} ${deg}° ${minFull.toFixed(3)}'`;

            const min = Math.floor(minFull);
            const sec = ((minFull - min) * 60).toFixed(2);
            return `${hemi} ${deg}° ${min}' ${sec}"`;
        };

        return `${formatSingle(lat, true)}  ${formatSingle(lon, false)}`;
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
            if (unit === 'NM') distDisplay = res.distance / 1852;

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

        const unit = document.getElementById('d_unit').value;
        const distMeters = (unit === 'NM') ? dist * 1852 : dist;

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
