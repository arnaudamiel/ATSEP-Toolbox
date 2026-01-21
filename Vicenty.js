/**
 * Vicenty.js
 * Pure WGS-84 Geodesic Calculation Module.
 * Contains no UI logic.
 */

const Vicenty = (function () {
    /**
     * WGS-84 Ellipsoid Constants
     */
    const WGS84_a = 6378137.0;          // Major axis (meters)
    const WGS84_b = 6356752.314245;     // Minor axis (meters)
    const WGS84_f = 1 / 298.257223563;  // Flattening

    /**
     * Vincenty's expansion coefficients (Helmert's series).
     * These are numerators of the Taylor series expansion for the geodesic distance, 
     * scaled to power-of-two denominators (2^14 and 2^10) to maintain integer 
     * accuracy in the original 1975 derivation.
     */
    const A_DENOM = 16384;
    const A_C1 = 4096;
    const A_C2 = -768;
    const A_C3 = 320;
    const A_C4 = -175;

    const B_DENOM = 1024;
    const B_C1 = 256;
    const B_C2 = -128;
    const B_C3 = 74;
    const B_C4 = -47;

    const CONVERGENCE_THRESHOLD = 1e-12;

    const toRad = d => d * Math.PI / 180;
    const toDeg = r => r * 180 / Math.PI;

    /**
     * Projects a destination point given a starting point, distance, and bearing.
     * @param {number} lat1 - Latitude of start point in degrees
     * @param {number} lon1 - Longitude of start point in degrees
     * @param {number} distanceMeters - Distance in meters
     * @param {number} bearingDegrees - Initial bearing in degrees
     * @returns {Object} { lat, lon, finalBearing }
     */
    function calculateDestination(lat1, lon1, distanceMeters, bearingDegrees) {
        const phi1 = toRad(lat1);
        const L1 = toRad(lon1);
        const alpha1 = toRad(bearingDegrees);
        const s = distanceMeters;

        const sinAlpha1 = Math.sin(alpha1);
        const cosAlpha1 = Math.cos(alpha1);

        const tanU1 = (1 - WGS84_f) * Math.tan(phi1);
        const cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1));
        const sinU1 = tanU1 * cosU1;

        const sigma1 = Math.atan2(tanU1, cosAlpha1);
        const sinAlpha = cosU1 * sinAlpha1;
        const cosSqAlpha = 1 - sinAlpha * sinAlpha;
        const uSq = cosSqAlpha * (WGS84_a * WGS84_a - WGS84_b * WGS84_b) / (WGS84_b * WGS84_b);

        // Vincenty's expansion coefficients for A and B
        const A_coeff = 1 + uSq / A_DENOM * (A_C1 + uSq * (A_C2 + uSq * (A_C3 + A_C4 * uSq)));
        const B_coeff = uSq / B_DENOM * (B_C1 + uSq * (B_C2 + uSq * (B_C3 + B_C4 * uSq)));

        let sigma = s / (WGS84_b * A_coeff);
        let sigmaP = 2 * Math.PI;
        let sinSigma, cosSigma, cos2SigmaM, deltaSigma;

        let iterLimit = 100;
        while (Math.abs(sigma - sigmaP) > CONVERGENCE_THRESHOLD && --iterLimit > 0) {
            cos2SigmaM = Math.cos(2 * sigma1 + sigma);
            sinSigma = Math.sin(sigma);
            cosSigma = Math.cos(sigma);
            deltaSigma = B_coeff * sinSigma * (cos2SigmaM + B_coeff / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
                B_coeff / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
            sigmaP = sigma;
            sigma = s / (WGS84_b * A_coeff) + deltaSigma;
        }

        if (iterLimit === 0) {
            throw new Error("Formula failed to converge");
        }

        const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
        const phi2 = Math.atan2(sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
            (1 - WGS84_f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp));

        const lambda = Math.atan2(sinSigma * sinAlpha1, cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1);
        const C = WGS84_f / 16 * cosSqAlpha * (4 + WGS84_f * (4 - 3 * cosSqAlpha));
        const L = lambda - (1 - C) * WGS84_f * sinAlpha *
            (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

        const L2 = L1 + L;

        // Calculate final bearing (reverse azimuth + 180)
        // For simple point projection we often just want coordinates, 
        // but fully replicating previous logic suggests we just returned coords.
        // We'll return coords as requested.

        return {
            lat: toDeg(phi2),
            lon: toDeg(L2)
        };
    }

    /**
     * Calculates the Geodesic distance and bearings between two points.
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {Object} { distance, initialBearing, isCoincident }
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const phi1 = toRad(lat1), L1 = toRad(lon1);
        const phi2 = toRad(lat2), L2 = toRad(lon2);

        const L = L2 - L1;

        const tanU1 = (1 - WGS84_f) * Math.tan(phi1);
        const cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1));
        const sinU1 = tanU1 * cosU1;

        const tanU2 = (1 - WGS84_f) * Math.tan(phi2);
        const cosU2 = 1 / Math.sqrt((1 + tanU2 * tanU2));
        const sinU2 = tanU2 * cosU2;

        let lambda = L;
        let lambdaP;
        let iterLimit = 100;

        let sinLambda, cosLambda, sinSigma, cosSigma, sigma, sinAlpha, cosSqAlpha, cos2SigmaM, C;

        do {
            sinLambda = Math.sin(lambda);
            cosLambda = Math.cos(lambda);
            sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
                (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));

            if (sinSigma === 0) {
                return { isCoincident: true, distance: 0, initialBearing: 0 };
            }

            cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
            sigma = Math.atan2(sinSigma, cosSigma);
            sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
            cosSqAlpha = 1 - sinAlpha * sinAlpha;

            cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
            if (isNaN(cos2SigmaM)) cos2SigmaM = 0;

            C = WGS84_f / 16 * cosSqAlpha * (4 + WGS84_f * (4 - 3 * cosSqAlpha));
            lambdaP = lambda;
            lambda = L + (1 - C) * WGS84_f * sinAlpha *
                (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

        } while (Math.abs(lambda - lambdaP) > CONVERGENCE_THRESHOLD && --iterLimit > 0);

        if (iterLimit === 0) {
            throw new Error("Antipodal Limit reached (Points are nearly opposite)");
        }

        const uSq = cosSqAlpha * (WGS84_a * WGS84_a - WGS84_b * WGS84_b) / (WGS84_b * WGS84_b);
        const A_coeff = 1 + uSq / A_DENOM * (A_C1 + uSq * (A_C2 + uSq * (A_C3 + A_C4 * uSq)));
        const B_coeff = uSq / B_DENOM * (B_C1 + uSq * (B_C2 + uSq * (B_C3 + B_C4 * uSq)));
        const deltaSigma = B_coeff * sinSigma * (cos2SigmaM + B_coeff / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
            B_coeff / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

        const s = WGS84_b * A_coeff * (sigma - deltaSigma);

        const fwdAz = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
        const initialBearing = (toDeg(fwdAz) + 360) % 360;

        return {
            distance: s,
            initialBearing: initialBearing,
            isCoincident: false
        };
    }

    return {
        calculateDestination,
        calculateDistance
    };
})();
