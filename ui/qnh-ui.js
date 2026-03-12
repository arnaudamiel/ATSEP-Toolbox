import { ATSEP_CONSTANTS, ERROR_MESSAGES } from '../constants.js';
import { QNH } from '../QNH.js';

let elements = {};

function cacheElements() {
    elements = {
        pressureInput: document.getElementById('pressureInput'),
        pressureUnit: document.getElementById('pressureUnit'),
        correctionUnit: document.getElementById('correctionUnit'),
        resultDisplay: document.getElementById('resultDisplay')
    };
}

function handlePressureUnitChange(e) {
    const el = e.target;
    const newUnit = el.value;
    const oldUnit = el.dataset.prev;
    const input = elements.pressureInput;

    if (input.value && oldUnit && newUnit !== oldUnit) {
        let val = parseFloat(input.value);
        if (!isNaN(val)) {
            if (newUnit === 'inHg' && oldUnit === 'hPa') {
                val = val * QNH.HPA_TO_INHG;
                input.value = val.toFixed(2);
            } else if (newUnit === 'hPa' && oldUnit === 'inHg') {
                val = val * QNH.INHG_TO_HPA;
                input.value = Math.round(val);
            }
        }
    }

    el.dataset.prev = newUnit;
    updatePressureInputAttributes();
}

function updatePressureInputAttributes() {
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

function calculateQnhCorrectionUI() {
    const inputRaw = parseFloat(elements.pressureInput ? elements.pressureInput.value : 0);
    const pUnit = elements.pressureUnit ? elements.pressureUnit.value : 'hPa';
    const outUnit = elements.correctionUnit ? elements.correctionUnit.value : 'feet';
    const display = elements.resultDisplay;

    if (!display) return;

    display.innerHTML = '';
    display.removeAttribute('data-warning');

    if (isNaN(inputRaw) || inputRaw <= 0) {
        const msg = ERROR_MESSAGES.INVALID_PRESSURE;
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

export function initQnh() {
    cacheElements();

    const qnhBtn = document.getElementById('calculateButton');
    if (qnhBtn) qnhBtn.addEventListener('click', calculateQnhCorrectionUI);

    if (elements.pressureInput) {
        elements.pressureInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                calculateQnhCorrectionUI();
            }
        });
    }

    if (elements.pressureUnit) {
        elements.pressureUnit.dataset.prev = elements.pressureUnit.value;
        elements.pressureUnit.addEventListener('change', handlePressureUnitChange);
        updatePressureInputAttributes();
    }
}
