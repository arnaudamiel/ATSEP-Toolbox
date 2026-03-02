const METERS_PER_DEGREE = 111319.5; // Approx meters per degree of latitude
const CEP_95_MULTIPLIER = 2.4477; // Multiplier for 95% Circular Error Probable (assuming circular normal distribution)

/**
 * Calculates standard deviation for a set of values relative to a mean
 */
function calculateStdDev(values, mean) {
    if (values.length === 0) return 0;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
}

/**
 * Processes GPS samples to calculate averages and precision metrics
 */
function calculateGPSMetrics(samples) {
    if (samples.length === 0) return null;

    const avgLat = samples.reduce((sum, s) => sum + s.lat, 0) / samples.length;
    const avgLon = samples.reduce((sum, s) => sum + s.lon, 0) / samples.length;

    const altSamples = samples.filter(s => s.alt !== null);
    const avgAlt = altSamples.length > 0
        ? altSamples.reduce((sum, s) => sum + s.alt, 0) / altSamples.length
        : null;

    const avgAcc = samples.reduce((sum, s) => sum + s.acc, 0) / samples.length;

    let avgGeoidSep = null;
    let avgMslAlt = avgAlt; // Default MSL altitude to raw GPS altitude

    // Apply EGM96 correction if grid is loaded, we have altitude, and it's not iOS
    if (avgAlt !== null && isEgm96Loaded) {
        avgGeoidSep = egm96Loader.getN(avgLat, avgLon);
        if (!isIOS) {
            avgMslAlt = avgAlt - avgGeoidSep;
        }
    }

    let stdDev = 0;
    let cep95 = 0;

    if (samples.length > 1) {
        const lats = samples.map(s => s.lat);
        const lons = samples.map(s => s.lon);
        const stdDevLat = calculateStdDev(lats, avgLat);
        const stdDevLon = calculateStdDev(lons, avgLon);

        // Convert to meters
        // Approximations for latitude and longitude to meters
        const latMeters = stdDevLat * METERS_PER_DEGREE;
        const lonMeters = stdDevLon * METERS_PER_DEGREE * Math.cos(avgLat * Math.PI / 180);
        stdDev = Math.sqrt(latMeters * latMeters + lonMeters * lonMeters);

        // CEP 95% (Circular Error Probable at 95% confidence)
        cep95 = CEP_95_MULTIPLIER * stdDev;
    }

    return {
        avgLat,
        avgLon,
        avgAlt,
        avgMslAlt,
        avgGeoidSep,
        avgAcc,
        stdDev,
        cep95
    };
}

// --- GPS Averaging App Logic ---
let gpsWatchId = null;
let gpsSamples = [];
let gpsStartTime = null;
let gpsElapsedTimer = null;
let gpsRejectedCount = 0;

// EGM96 Geoid Loader instance
const egm96Loader = new EGM96Loader();
// State to track if grid is loaded successfully
let isEgm96Loaded = false;

// iOS detection: iPhones naturally provide altitude relative to MSL
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Attempt to load the grid data asynchronously
egm96Loader.load('WW15MGH.GRD')
    .then(() => {
        isEgm96Loaded = true;
        console.log('EGM96 Geoid grid loaded successfully');
    })
    .catch(err => {
        console.error('Failed to load EGM96 grid:', err);
    });

function formatCoord(deg, isLat) {
    if (isNaN(deg)) return '--';
    const num = Math.abs(deg);
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');

    // Get globally selected format or fallback to DMS as default
    const fmtSel = document.getElementById('gps_fmt_sel');
    const fmt = fmtSel ? fmtSel.value : 'DMS';

    if (fmt === 'DD') {
        return `${num.toFixed(5)}° ${dir}`;
    } else if (fmt === 'DDM') {
        const d = Math.floor(num);
        const m = ((num - d) * 60).toFixed(4);
        return `${d}° ${m}' ${dir}`;
    } else { // DMS
        const d = Math.floor(num);
        const m = Math.floor((num - d) * 60);
        const s = ((num - d - m / 60) * 3600).toFixed(2);
        return `${d}° ${m}' ${s}" ${dir}`;
    }
}

function updateGPSUI() {
    const metrics = calculateGPSMetrics(gpsSamples);

    document.getElementById('gps_samples').textContent = gpsSamples.length;
    document.getElementById('gps_rejected').textContent = gpsRejectedCount;

    if (!metrics) {
        document.getElementById('gps_lat').textContent = '--';
        document.getElementById('gps_lon').textContent = '--';
        document.getElementById('gps_alt').textContent = '--';
        document.getElementById('gps_geoid_sep').textContent = '--';
        document.getElementById('gps_acc').textContent = '--';
        document.getElementById('gps_stddev').textContent = '--';
        document.getElementById('gps_cep').textContent = '--';
        return;
    }

    document.getElementById('gps_lat').textContent = formatCoord(metrics.avgLat, true);
    document.getElementById('gps_lon').textContent = formatCoord(metrics.avgLon, false);

    // Determine units
    const altUnitSel = document.getElementById('gps_alt_unit');
    const altUnit = altUnitSel ? altUnitSel.value : 'meters';
    const isFeet = altUnit === 'feet';
    const unitLabel = isFeet ? 'ft' : 'm';

    // Use conversion factor from constants
    const convert = (val) => isFeet ? val * (typeof ATSEP_CONSTANTS !== 'undefined' ? ATSEP_CONSTANTS.METERS_TO_FEET : 3.28084) : val;
    const formatVal = (val) => isFeet ? Math.round(convert(val)).toString() : convert(val).toFixed(1);

    // Display Height
    if (metrics.avgMslAlt !== null) {
        let altText = `${formatVal(metrics.avgMslAlt)} ${unitLabel}`;
        // if it's iOS, MSL alt is the raw GPS alt, geoid separation is ignored
        if (isIOS) altText += ' (native MSL)';
        document.getElementById('gps_alt').textContent = altText;
    } else {
        document.getElementById('gps_alt').textContent = 'N/A';
    }

    document.getElementById('gps_geoid_sep').textContent = metrics.avgGeoidSep !== null ? `${formatVal(metrics.avgGeoidSep)} ${unitLabel}` : '--';
    document.getElementById('gps_acc').textContent = `${formatVal(metrics.avgAcc)} ${unitLabel}`;

    document.getElementById('gps_stddev').textContent = metrics.stdDev ? `±${formatVal(metrics.stdDev)} ${unitLabel}` : '--';
    document.getElementById('gps_cep').textContent = metrics.cep95 ? `±${formatVal(metrics.cep95)} ${unitLabel}` : '--';

    // Update quality indicator
    const qv = document.getElementById('qualityValue');
    const ql = document.getElementById('qualityLabel');
    const acc = metrics.avgAcc;

    if (acc < 5) {
        qv.textContent = 'Excellent';
        qv.className = 'result-positive';
        qv.style.fontSize = '1.5rem';
        ql.textContent = 'Optimal accuracy for averaging';
    } else if (acc < 10) {
        qv.textContent = 'Good';
        qv.className = 'result-success';
        qv.style.fontSize = '1.5rem';
        ql.textContent = 'Acceptable for most uses';
    } else if (acc < 20) {
        qv.textContent = 'Fair';
        qv.className = 'warning-text';
        qv.style.fontSize = '1.5rem';
        ql.textContent = 'Consider finding a clearer sky view';
    } else {
        qv.textContent = 'Poor';
        qv.className = 'result-error';
        qv.style.fontSize = '1.5rem';
        ql.textContent = 'Accuracy is too low for reliable averaging';
    }
}

function handlePosition(position) {
    const pos = position.coords;

    // Outlier filtering based on 3-sigma rule if we have enough samples
    if (gpsSamples.length > 10) {
        const metrics = calculateGPSMetrics(gpsSamples);
        const lats = gpsSamples.map(s => s.lat);
        const lons = gpsSamples.map(s => s.lon);

        const latMetersDiff = Math.abs(pos.latitude - metrics.avgLat) * METERS_PER_DEGREE;
        const lonMetersDiff = Math.abs(pos.longitude - metrics.avgLon) * METERS_PER_DEGREE * Math.cos(metrics.avgLat * Math.PI / 180);
        const distFromMean = Math.sqrt(latMetersDiff * latMetersDiff + lonMetersDiff * lonMetersDiff);

        // Reject if it's more than 3 standard deviations away
        if (metrics.stdDev > 0 && distFromMean > 3 * metrics.stdDev) {
            gpsRejectedCount++;
            document.getElementById('gps_rejected').textContent = gpsRejectedCount;
            return;
        }
    }

    gpsSamples.push({
        lat: pos.latitude,
        lon: pos.longitude,
        alt: pos.altitude,
        acc: pos.accuracy,
        time: position.timestamp
    });

    updateGPSUI();
}

function handleGPSError(error) {
    const errorEl = document.getElementById('gps_error');
    errorEl.classList.remove('hidden');
    switch (error.code) {
        case error.PERMISSION_DENIED:
            errorEl.textContent = "Location access denied. Please allow location permissions.";
            break;
        case error.POSITION_UNAVAILABLE:
            errorEl.textContent = "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            errorEl.textContent = "The request to get user location timed out.";
            break;
        case error.UNKNOWN_ERROR:
            errorEl.textContent = "An unknown error occurred.";
            break;
    }
    stopAveraging();
}

function updateElapsedTime() {
    if (!gpsStartTime) return;
    const now = new Date();
    const diff = Math.floor((now - gpsStartTime) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    document.getElementById('gps_elapsed').textContent = `${mins}m ${secs}s`;
}

window.startAveraging = function () {
    if (!navigator.geolocation) {
        const errorEl = document.getElementById('gps_error');
        errorEl.classList.remove('hidden');
        errorEl.textContent = "Geolocation is not supported by this browser.";
        return;
    }

    // Reset data
    gpsSamples = [];
    gpsRejectedCount = 0;
    gpsStartTime = new Date();
    updateGPSUI();
    document.getElementById('gps_error').classList.add('hidden');

    document.getElementById('startGpsBtn').disabled = true;
    document.getElementById('stopGpsBtn').disabled = false;
    document.getElementById('resetGpsBtn').disabled = true;

    document.getElementById('gps_status').textContent = "Averaging in progress...";
    document.getElementById('gps_status').className = "result-positive text-center mb-half";

    gpsWatchId = navigator.geolocation.watchPosition(handlePosition, handleGPSError, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    });

    gpsElapsedTimer = setInterval(updateElapsedTime, 1000);
};

window.stopAveraging = function () {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    if (gpsElapsedTimer !== null) {
        clearInterval(gpsElapsedTimer);
        gpsElapsedTimer = null;
    }

    document.getElementById('startGpsBtn').disabled = false;
    document.getElementById('stopGpsBtn').disabled = true;
    document.getElementById('resetGpsBtn').disabled = false;

    if (gpsSamples.length > 0) {
        document.getElementById('gps_status').textContent = "Averaging completed.";
        document.getElementById('gps_status').className = "result-success text-center mb-half";
    } else {
        document.getElementById('gps_status').textContent = "Ready to start";
        document.getElementById('gps_status').className = "warning-text text-center mb-half";
    }
};

window.resetData = function () {
    gpsSamples = [];
    gpsRejectedCount = 0;
    gpsStartTime = null;
    document.getElementById('gps_elapsed').textContent = "0s";
    updateGPSUI();

    document.getElementById('startGpsBtn').disabled = false;
    document.getElementById('stopGpsBtn').disabled = true;
    document.getElementById('resetGpsBtn').disabled = true;

    document.getElementById('gps_status').textContent = "Ready to start";
    document.getElementById('gps_status').className = "warning-text text-center mb-half";
    document.getElementById('gps_error').classList.add('hidden');

    document.getElementById('qualityValue').textContent = '--';
    document.getElementById('qualityValue').className = 'result-positive';
    document.getElementById('qualityLabel').textContent = 'Waiting to start...';
};

window.updateGPSUI = updateGPSUI;

document.addEventListener('DOMContentLoaded', () => {
    // Attach event listeners to buttons using the functions defined above
    const startBtn = document.getElementById('startGpsBtn');
    const stopBtn = document.getElementById('stopGpsBtn');
    const resetBtn = document.getElementById('resetGpsBtn');

    // Add event listener for altitude unit change
    const altUnitSel = document.getElementById('gps_alt_unit');

    if (startBtn) startBtn.addEventListener('click', window.startAveraging);
    if (stopBtn) stopBtn.addEventListener('click', window.stopAveraging);
    if (resetBtn) resetBtn.addEventListener('click', window.resetData);
    if (altUnitSel) altUnitSel.addEventListener('change', window.updateGPSUI);
});
