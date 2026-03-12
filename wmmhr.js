/**
 * WMMHR2025 - World Magnetic Model High Resolution 2025 (JavaScript Implementation)
 * Based on the NGA/NOAA World Magnetic Model High Resolution (WMMHR) Technical Report.
 * Suitable for expansion up to degree 133.
 */

const WMMHR = (function () {
    // WGS-84 Ellipsoid Constants
    const a = 6378.137;           // Semi-major axis (km)
    const f = 1.0 / 298.257223563; // Flattening
    const b = a * (1.0 - f);      // Semi-minor axis (km)
    const re = 6371.2;            // Earth's reference radius (km)
    const epssq = 1.0 - (b * b) / (a * a);

    // Model Constants
    const MAX_N = 133;
    const NUM_TERMS = (MAX_N + 1) * (MAX_N + 2) / 2;
    // EPOCH is now dynamic, initialized to 0 until data load
    let EPOCH = 0.0;

    // Internal State
    let C = new Float64Array(NUM_TERMS);  // Main Field Coefficients (g)
    let S = new Float64Array(NUM_TERMS);  // Main Field Coefficients (h)
    let CD = new Float64Array(NUM_TERMS); // Secular Variation (dg/dt)
    let SD = new Float64Array(NUM_TERMS); // Secular Variation (dh/dt)
    let initialized = false;

    /**
     * Loads the WMMHR coefficients from the specified URL.
     * @param {string} url - The URL to the WMMHR.COF file (default: 'WMMHR.COF.gz')
     * @returns {Promise<void>}
     */
    async function load(onProgress, url = 'WMMHR.COF.gz') {
        if (initialized) return;

        try {
            onProgress?.('loading');
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load WMMHR data: ${response.status}`);

            // Fetch as stream for decompression
            const ds = new DecompressionStream('gzip');
            const decompressed = response.body.pipeThrough(ds);
            const reader = decompressed.getReader();
            const decoder = new TextDecoder();
            let data = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                data += decoder.decode(value, { stream: true });
            }
            data += decoder.decode(); // final flush

            _parse(data);
            onProgress?.('ready');
        } catch (error) {
            onProgress?.('error', error.message);
            console.error("WMMHR Load Error:", error);
            throw error;
        }
    }

    /**
     * Parses the WMMHR coefficients data.
     * @param {string} dataString - The contents of WMMHR.COF
     * @private
     */
    function _parse(dataString) {
        if (initialized) return;

        let data = dataString;
        if (!data) {
            console.error("WMMHR Error: No data provided.");
            return;
        }

        const lines = data.trim().split('\n');

        // Parse Header (Line 1) for Epoch
        // Example: "    2025.0           WMMHR-2025       11/13/2024"
        const headerParts = lines[0].trim().split(/\s+/);
        if (headerParts.length > 0) {
            EPOCH = parseFloat(headerParts[0]);
        } else {
            console.warn("WMMHR Warning: Could not parse Epoch from header, using default 2025.0");
            EPOCH = 2025.0;
        }

        C.fill(0); S.fill(0); CD.fill(0); SD.fill(0);

        // Parse coefficients line by line (skip header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.trim().split(/\s+/);
            if (parts.length < 6) continue;

            const n = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            if (isNaN(n) || n > MAX_N) continue;

            const g = parseFloat(parts[2]);
            const h = parseFloat(parts[3]);
            const dg = parseFloat(parts[4]);
            const dh = parseFloat(parts[5]);

            // Map (n, m) to a 1D array index
            const index = (n * (n + 1) / 2 + m);
            C[index] = g;
            S[index] = h;
            CD[index] = dg;
            SD[index] = dh;
        }

        initialized = true;
        console.log(`WMMHR2025 Engine Initialized (Degree 133, Epoch ${EPOCH})`);
    }

    /**
     * Calculates the magnetic field components.
     * @param {number} lat - Geodetic Latitude (degrees)
     * @param {number} lon - Geodetic Longitude (degrees)
     * @param {number} altKm - Altitude (km)
     * @param {number} year - Decimal Year (e.g., 2025.5)
     */
    function calc(lat, lon, altKm, year) {
        if (!initialized) {
            console.warn("WMMHR not initialized. Call WMMHR.load() first.");
            return { D: 0, I: 0, H: 0, X: 0, Y: 0, Z: 0, F: 0, dD: 0, dI: 0, dH: 0, dX: 0, dY: 0, dZ: 0, dF: 0, eD: 0, eI: 0, eH: 0, eF: 0, eX: 0, eY: 0, eZ: 0 };
        }

        const dt = year - EPOCH;
        const rLat = lat * (Math.PI / 180);
        const rLon = lon * (Math.PI / 180);

        const sinLat = Math.sin(rLat);
        const cosLat = Math.cos(rLat);

        // Geodetic to Spherical Coordinate Conversion
        const rc = a / Math.sqrt(1.0 - epssq * sinLat * sinLat);
        const xp = (rc + altKm) * cosLat;
        const zp = (rc * (1.0 - epssq) + altKm) * sinLat;
        const r = Math.sqrt(xp * xp + zp * zp);

        const sinPhi = zp / r;
        const cosPhi = xp / r;
        const phig = Math.asin(sinPhi);

        // Compute Associated Legendre Polynomials (Numerical Stability for high degrees)
        const P = new Float64Array(NUM_TERMS);
        const DP = new Float64Array(NUM_TERMS); // Derivative dP/dLat

        const scalef = 1.0e-280; // Scaling factor to prevent overflow
        const x = sinPhi;
        const z = Math.sqrt(Math.max(0, (1.0 - x) * (1.0 + x)));

        if (z === 0 && Math.abs(x) === 1.0) {
            // Poles Handle: Use a tiny offset to avoid singularity in derivatives
            return calc(lat > 0 ? 89.99999 : -89.99999, lon, altKm, year);
        }

        // Recursion coefficients pre-calculation
        const PreSqr = new Float64Array(2 * MAX_N + 2);
        for (let n = 0; n <= 2 * MAX_N + 1; n++) PreSqr[n] = Math.sqrt(n);

        const f1 = new Float64Array(NUM_TERMS);
        const f2 = new Float64Array(NUM_TERMS);
        let k = 2; // Start index for n=2

        for (let n = 2; n <= MAX_N; n++) {
            k++; // index for m=0
            f1[k] = (2 * n - 1) / n;
            f2[k] = (n - 1) / n;
            for (let m = 1; m <= n - 2; m++) {
                k++;
                f1[k] = (2 * n - 1) / (PreSqr[n + m] * PreSqr[n - m]);
                f2[k] = (PreSqr[n - m - 1] * PreSqr[n + m - 1]) / (PreSqr[n + m] * PreSqr[n - m]);
            }
            k += 2; // skip m=n-1 and m=n
        }

        // Recursion for m=0
        let pm2 = 1.0;
        P[0] = 1.0;
        DP[0] = 0.0;
        let pm1 = x;
        P[1] = pm1;
        DP[1] = z;
        k = 1;
        for (let n = 2; n <= MAX_N; n++) {
            k += n;
            let plm = f1[k] * x * pm1 - f2[k] * pm2;
            P[k] = plm;
            DP[k] = n * (pm1 - x * plm) / z;
            pm2 = pm1;
            pm1 = plm;
        }

        // Recursion for m > 0 (Sectoral and Tesseral Harmonics)
        let pmm = PreSqr[2] * scalef;
        let rescalem = 1.0 / scalef;
        let kstart = 0;
        for (let m = 1; m < MAX_N; m++) {
            rescalem *= z;
            // P(m,m)
            kstart += m + 1;
            pmm = pmm * PreSqr[2 * m + 1] / PreSqr[2 * m];
            P[kstart] = pmm * rescalem / PreSqr[2 * m + 1];
            DP[kstart] = -(m * x * P[kstart] / z);
            pm2 = pmm / PreSqr[2 * m + 1];
            // P(m+1,m)
            k = kstart + m + 1;
            pm1 = x * PreSqr[2 * m + 1] * pm2;
            P[k] = pm1 * rescalem;
            DP[k] = ((pm2 * rescalem) * PreSqr[2 * m + 1] - x * (m + 1) * P[k]) / z;
            // n > m+1
            for (let n = m + 2; n <= MAX_N; n++) {
                k += n;
                let plm = x * f1[k] * pm1 - f2[k] * pm2;
                P[k] = plm * rescalem;
                DP[k] = (PreSqr[n + m] * PreSqr[n - m] * (pm1 * rescalem) - n * x * P[k]) / z;
                pm2 = pm1;
                pm1 = plm;
            }
        }
        // P(MAX_N, MAX_N) last term
        rescalem *= z;
        kstart += MAX_N + 1;
        pmm = pmm / PreSqr[2 * MAX_N];
        P[kstart] = pmm * rescalem;
        DP[kstart] = -(MAX_N * x * P[kstart] / z);

        // Spherical Harmonic Summation
        const rRatio = re / r;
        const RelativeRadiusPower = new Float64Array(MAX_N + 1);
        RelativeRadiusPower[0] = rRatio * rRatio; // (a/r)^2
        for (let n = 1; n <= MAX_N; n++) RelativeRadiusPower[n] = RelativeRadiusPower[n - 1] * rRatio;

        // Longitude harmonics
        const cos_ml = new Float64Array(MAX_N + 1);
        const sin_ml = new Float64Array(MAX_N + 1);
        const cl1 = Math.cos(rLon);
        const sl1 = Math.sin(rLon);
        cos_ml[0] = 1; sin_ml[0] = 0;
        cos_ml[1] = cl1; sin_ml[1] = sl1;
        for (let m = 2; m <= MAX_N; m++) {
            cos_ml[m] = cos_ml[m - 1] * cl1 - sin_ml[m - 1] * sl1;
            sin_ml[m] = sin_ml[m - 1] * cl1 + cos_ml[m - 1] * sl1;
        }

        let Br = 0, Bt = 0, Bp = 0;
        let dBr = 0, dBt = 0, dBp = 0;

        // Accumulate field components
        for (let n = 1; n <= MAX_N; n++) {
            for (let m = 0; m <= n; m++) {
                const idx = n * (n + 1) / 2 + m;
                // Field + Secular Variation
                const g = C[idx] + dt * CD[idx];
                const h = S[idx] + dt * SD[idx];
                const dg = CD[idx];
                const dh = SD[idx];

                const term_cos = g * cos_ml[m] + h * sin_ml[m];
                const term_sin = h * cos_ml[m] - g * sin_ml[m];

                const p_nm = P[idx];
                const dp_nm = DP[idx];

                // Spherical summation terms
                Br -= RelativeRadiusPower[n] * (n + 1) * (g * cos_ml[m] + h * sin_ml[m]) * p_nm;
                Bt -= RelativeRadiusPower[n] * (g * cos_ml[m] + h * sin_ml[m]) * dp_nm;
                if (m > 0) {
                    Bp += RelativeRadiusPower[n] * m * (g * sin_ml[m] - h * cos_ml[m]) * p_nm;
                }

                // Rates of change
                dBr -= RelativeRadiusPower[n] * (n + 1) * (dg * cos_ml[m] + dh * sin_ml[m]) * p_nm;
                dBt -= RelativeRadiusPower[n] * (dg * cos_ml[m] + dh * sin_ml[m]) * dp_nm;
                if (m > 0) {
                    dBp += RelativeRadiusPower[n] * m * (dg * sin_ml[m] - dh * cos_ml[m]) * p_nm;
                }
            }
        }

        // East component scaling
        if (Math.abs(cosPhi) > 1e-10) {
            Bp /= cosPhi;
            dBp /= cosPhi;
        } else {
            Bp = 0; dBp = 0;
        }

        // Rotate from Spherical to Geodetic Frame
        const psi = phig - rLat;
        const sinPsi = Math.sin(psi);
        const cosPsi = Math.cos(psi);

        // X = North, Y = East, Z = Down
        const Bx_s = Bt;
        const By_s = Bp;
        const Bz_s = Br;

        const X = Bx_s * cosPsi - Bz_s * sinPsi;
        const Y = By_s;
        const Z = Bx_s * sinPsi + Bz_s * cosPsi;

        const dX = (-dBt) * cosPsi - (-dBr) * sinPsi;
        const dY = dBp;
        const dZ = (-dBt) * sinPsi + (-dBr) * cosPsi;

        // Derived Parameters
        const H = Math.sqrt(X * X + Y * Y);
        const F = Math.sqrt(H * H + Z * Z);
        const I = Math.atan2(Z, H) * (180 / Math.PI);
        const D = Math.atan2(Y, X) * (180 / Math.PI);

        // Derived Rates
        let dD = 0, dI = 0, dH = 0, dF = 0;
        if (H > 0) {
            dH = (X * dX + Y * dY) / H;
            dD = ((X * dY - Y * dX) / (H * H)) * (180 / Math.PI);
        }
        if (F > 0) {
            dF = (X * dX + Y * dY + Z * dZ) / F;
            dI = ((H * dZ - Z * dH) / (F * F)) * (180 / Math.PI);
        }

        // Static Uncertainty Estimates (WMMHR-2025 Standard)
        const eD = Math.sqrt(Math.pow(0.25, 2) + Math.pow(5205 / H, 2));
        const eI = 0.19;
        const eH = 130;
        const eF = 134;
        const eX = 135;
        const eY = 85;
        const eZ = 134;

        // D in degrees
        // I in degrees
        // H in nano Teslas
        // X in nano Teslas
        // Y in nano Teslas
        // Z in nano Teslas
        // F in nano Teslas
        // dD in degrees per year
        // dI in degrees per year
        // dH in nano Teslas per year
        // dX in nano Teslas per year
        // dY in nano Teslas per year
        // dZ in nano Teslas per year
        // dF in nano Teslas per year
        // eD in degrees
        // eI in degrees
        // eH in nano Teslas
        // eF in nano Teslas
        // eX in nano Teslas
        // eY in nano Teslas
        // eZ in nano Teslas    
        return { D, I, H, X, Y, Z, F, dD, dI, dH, dX, dY, dZ, dF, eD, eI, eH, eF, eX, eY, eZ };
    }

    return {
        load,
        isInitialized: () => initialized,
        getEpoch: () => EPOCH,
        calc
    };
})();
