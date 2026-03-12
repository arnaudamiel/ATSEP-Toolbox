import { ATSEP_CONSTANTS, ERROR_MESSAGES } from '../constants.js';
import { Vincenty } from '../Vincenty.js';
import { SafeStorage } from './shared-ui.js';

let elements = {};

function cacheElements() {
    elements = {
        rangeRes: document.getElementById('range_res'),
        rangeUnitType: document.getElementById('range_unit_type')
    };
}

function validateAndGetCoords(prefix, errorContainerId) {
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

function runRange() {
    const p1 = validateAndGetCoords('r_origin', 'range_res');
    const p2 = validateAndGetCoords('r_dest', 'range_res');

    if (!p1 || !p2) return;

    try {
        const res = Vincenty.calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
        const unit = elements.rangeUnitType ? elements.rangeUnitType.value : 'NM';

        let distDisplay = res.distance;
        if (unit === 'NM') distDisplay = res.distance / ATSEP_CONSTANTS.METERS_PER_NM;

        const html = `
            <div class="result-row"><span class="label">Range:</span> <span class="val">${distDisplay.toFixed(2)} ${unit}</span></div>
            <div class="result-row"><span class="label">Bearing:</span> <span class="val">${Math.round(res.initialBearing)}° (T)</span></div>
        `;
        elements.rangeRes.innerHTML = html;
    } catch (e) {
        elements.rangeRes.innerHTML = `<span class="result-error">Error: ${e.message}</span>`;
    }
}

function swapRangeInputs() {
    const p1Lat = SafeStorage.getItem('r_origin_lat_dd');
    const p1Lon = SafeStorage.getItem('r_origin_lon_dd');
    const p2Lat = SafeStorage.getItem('r_dest_lat_dd');
    const p2Lon = SafeStorage.getItem('r_dest_lon_dd');

    SafeStorage.setItem('r_origin_lat_dd', p2Lat || 0);
    SafeStorage.setItem('r_origin_lon_dd', p2Lon || 0);
    SafeStorage.setItem('r_dest_lat_dd', p1Lat || 0);
    SafeStorage.setItem('r_dest_lon_dd', p1Lon || 0);

    // Provide a callback or globally emit an event to re-render in `ui.js`
    if (window.updateDependentUI) window.updateDependentUI();
}

export function initRange() {
    cacheElements();

    const rangeBtn = document.querySelector('#range-panel .calculate-btn');
    if (rangeBtn) rangeBtn.addEventListener('click', runRange);

    const swapBtn = document.getElementById('swapRangeBtn');
    if (swapBtn) swapBtn.addEventListener('click', swapRangeInputs);
}

// Export for dest-ui and magvar-ui to reuse coord validation hook
export { validateAndGetCoords };
