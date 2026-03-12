import { ATSEP_CONSTANTS, ERROR_MESSAGES } from '../constants.js';
import { Vincenty } from '../Vincenty.js';
import { formatCoord } from './shared-ui.js';
import { validateAndGetCoords } from './range-ui.js';

let elements = {};

function cacheElements() {
    elements = {
        destRes: document.getElementById('dest_res'),
        destUnit: document.getElementById('d_unit'),
        distInput: document.getElementById('d_dist'),
        brngInput: document.getElementById('d_brng')
    };
}

function formatCoordsHtml(lat, lon) {
    return `<span class="coord-val">${formatCoord(lat, true)}</span><span class="coord-val">${formatCoord(lon, false)}</span>`;
}

function runDest() {
    const start = validateAndGetCoords('d_start', 'dest_res');
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
        const msg = ERROR_MESSAGES.NEGATIVE_RANGE;
        elements.destRes.innerHTML = `<span class="result-error">${msg}</span>`;
        return;
    }

    if (brng < -360 || brng > 360) {
        const msg = ERROR_MESSAGES.INVALID_BEARING;
        elements.destRes.innerHTML = `<span class="result-error">${msg}</span>`;
        return;
    }

    const unit = elements.destUnit ? elements.destUnit.value : 'NM';
    const distMeters = (unit === 'NM') ? dist * ATSEP_CONSTANTS.METERS_PER_NM : dist;

    try {
        const dest = Vincenty.calculateDestination(start.lat, start.lon, distMeters, brng);
        elements.destRes.innerHTML = `<span class="result-success">${formatCoordsHtml(dest.lat, dest.lon)}</span>`;
    } catch (e) {
        elements.destRes.innerHTML = `<span class="result-error">Error: ${e.message}</span>`;
    }
}

export function initDest() {
    cacheElements();

    const destBtn = document.querySelector('#dest-panel .calculate-btn');
    if (destBtn) destBtn.addEventListener('click', runDest);
}
