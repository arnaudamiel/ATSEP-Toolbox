/**
 * Vincenty.js
 * Pure WGS-84 Geodesic Calculation Module using Vincenty's Formulae.
 * 
 * This module implements Thaddeus Vincenty's iterative algorithms for
 * calculating geodesic distances and bearings on the WGS-84 ellipsoid.
 * Accuracy is typically within a few millimeters.
 * 
 * References:
 * - Vincenty, T. (1975). "Direct and Inverse Solutions of Geodesics on the
 *   Ellipsoid with application of nested equations". Survey Review. 23 (176): 88–93.
 * - WGS-84 ellipsoid parameters from NIMA TR8350.2
 * 
 * @module Vincenty
 * @author ATSEP Toolbox
 */

const Vincenty = (function () {
    // Use shared constants if available, otherwise use local definitions
    const a = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.WGS84_A : 6378137.0;
    const b = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.WGS84_B : 6356752.314245;
    const f = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.WGS84_F : 1 / 298.257223563;

    const CONVERGENCE_THRESHOLD = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.VINCENTY_CONVERGENCE : 1e-12;
    const MAX_ITERATIONS = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.VINCENTY_MAX_ITERATIONS : 100;

    /**
     * Vincenty's expansion coefficients (Helmert's series).
     * These are numerators of the Taylor series expansion for the geodesic distance,
     * scaled to power-of-two denominators (2^14 and 2^10) to maintain integer
     * accuracy in the original 1975 derivation.
     */
    const A_DENOM = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_A_DENOM : 16384;
    const A_C1 = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_A_C1 : 4096;
    const A_C2 = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_A_C2 : -768;
    const A_C3 = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_A_C3 : 320;
    const A_C4 = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_A_C4 : -175;

    const B_DENOM = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_B_DENOM : 1024;
    const B_C1 = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_B_C1 : 256;
    const B_C2 = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_B_C2 : -128;
    const B_C3 = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_B_C3 : 74;
    const B_C4 = (typeof ATSEP_CONSTANTS !== 'undefined') ? ATSEP_CONSTANTS.VINCENTY_B_C4 : -47;

    /**
     * Converts degrees to radians
     * @param {number} d - Angle in degrees
     * @returns {number} Angle in radians
     */
    const toRad = d => d * Math.PI / 180;

    /**
     * Converts radians to degrees
     * @param {number} r - Angle in radians
     * @returns {number} Angle in degrees
     */
    const toDeg = r => r * 180 / Math.PI;

    /**
     * Projects a destination point given a starting point, distance, and bearing.
     * This implements Vincenty's "direct" geodesic problem.
     * 
     * @param {number} lat1 - Latitude of start point in degrees (-90 to +90)
     * @param {number} lon1 - Longitude of start point in degrees (-180 to +180)
     * @param {number} distanceMeters - Distance to travel in meters
     * @param {number} bearingDegrees - Initial bearing in degrees (0-360, true north)
     * @returns {Object} Result object with properties:
     *   - lat: Latitude of destination in degrees
     *   - lon: Longitude of destination in degrees
     * @throws {Error} If the formula fails to converge
     * 
     * @example
     * // Project 100km east from London
     * const dest = Vincenty.calculateDestination(51.5, -0.1, 100000, 90);
     * console.log(dest.lat, dest.lon);
     */
    function calculateDestination(lat1, lon1, distanceMeters, bearingDegrees) {
        // === Step 1: Convert inputs to radians ===
        const phi1 = toRad(lat1);
        const L1 = toRad(lon1);
        const alpha1 = toRad(bearingDegrees);
        const s = distanceMeters;

        // === Step 2: Calculate trigonometric values ===
        const sinAlpha1 = Math.sin(alpha1);
        const cosAlpha1 = Math.cos(alpha1);

        // Reduced latitude: tan(U) = (1-f) * tan(phi)
        // This projects the point onto an auxiliary sphere
        const tanU1 = (1 - f) * Math.tan(phi1);
        const cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1));
        const sinU1 = tanU1 * cosU1;

        // === Step 3: Calculate angular distance on auxiliary sphere ===
        const sigma1 = Math.atan2(tanU1, cosAlpha1);
        const sinAlpha = cosU1 * sinAlpha1;
        const cosSqAlpha = 1 - sinAlpha * sinAlpha;

        // u² = cos²α × (a²-b²)/b²
        const uSq = cosSqAlpha * (a * a - b * b) / (b * b);

        // === Step 4: Calculate Vincenty's A and B coefficients ===
        // A = 1 + u²/16384 × {4096 + u² × [-768 + u² × (320 - 175×u²)]}
        const A_coeff = 1 + uSq / A_DENOM * (A_C1 + uSq * (A_C2 + uSq * (A_C3 + A_C4 * uSq)));
        // B = u²/1024 × {256 + u² × [-128 + u² × (74 - 47×u²)]}
        const B_coeff = uSq / B_DENOM * (B_C1 + uSq * (B_C2 + uSq * (B_C3 + B_C4 * uSq)));

        // === Step 5: Iterate to find σ (angular distance on sphere) ===
        let sigma = s / (b * A_coeff);
        let sigmaP = 2 * Math.PI;
        let sinSigma, cosSigma, cos2SigmaM, deltaSigma;

        let iterLimit = MAX_ITERATIONS;
        while (Math.abs(sigma - sigmaP) > CONVERGENCE_THRESHOLD && --iterLimit > 0) {
            cos2SigmaM = Math.cos(2 * sigma1 + sigma);
            sinSigma = Math.sin(sigma);
            cosSigma = Math.cos(sigma);

            // Calculate Δσ correction term
            deltaSigma = B_coeff * sinSigma * (cos2SigmaM + B_coeff / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
                B_coeff / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

            sigmaP = sigma;
            sigma = s / (b * A_coeff) + deltaSigma;
        }

        if (iterLimit === 0) {
            const msg = (typeof ERROR_MESSAGES !== 'undefined')
                ? ERROR_MESSAGES.CONVERGENCE_FAILED
                : "Formula failed to converge";
            throw new Error(msg);
        }

        // === Step 6: Calculate destination coordinates ===
        const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
        const phi2 = Math.atan2(sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
            (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp));

        const lambda = Math.atan2(sinSigma * sinAlpha1, cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1);
        const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
        const L = lambda - (1 - C) * f * sinAlpha *
            (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

        const L2 = L1 + L;

        return {
            lat: toDeg(phi2),
            lon: toDeg(L2)
        };
    }

    /**
     * Calculates the geodesic distance and bearings between two points.
     * This implements Vincenty's "inverse" geodesic problem.
     * 
     * @param {number} lat1 - Latitude of first point in degrees (-90 to +90)
     * @param {number} lon1 - Longitude of first point in degrees (-180 to +180)
     * @param {number} lat2 - Latitude of second point in degrees (-90 to +90)
     * @param {number} lon2 - Longitude of second point in degrees (-180 to +180)
     * @returns {Object} Result object with properties:
     *   - distance: Geodesic distance in meters
     *   - initialBearing: Initial bearing from point 1 to point 2 in degrees (0-360)
     *   - isCoincident: True if points are the same location
     * @throws {Error} If points are antipodal (opposite sides of Earth)
     * 
     * @example
     * // Calculate distance from London to Paris
     * const result = Vincenty.calculateDistance(51.5074, -0.1278, 48.8566, 2.3522);
     * console.log(result.distance / 1000 + ' km'); // ~343 km
     */
    function calculateDistance(lat1, lon1, lat2, lon2) {
        // === Step 1: Convert to radians and compute reduced latitudes ===
        const phi1 = toRad(lat1), L1 = toRad(lon1);
        const phi2 = toRad(lat2), L2 = toRad(lon2);

        const L = L2 - L1;  // Difference in longitude

        // Reduced latitude: tan(U) = (1-f) * tan(phi)
        // Projects points onto auxiliary sphere
        const tanU1 = (1 - f) * Math.tan(phi1);
        const cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1));
        const sinU1 = tanU1 * cosU1;

        const tanU2 = (1 - f) * Math.tan(phi2);
        const cosU2 = 1 / Math.sqrt((1 + tanU2 * tanU2));
        const sinU2 = tanU2 * cosU2;

        // === Step 2: Iteratively solve for λ (longitude on auxiliary sphere) ===
        let lambda = L;
        let lambdaP;
        let iterLimit = MAX_ITERATIONS;

        let sinLambda, cosLambda, sinSigma, cosSigma, sigma, sinAlpha, cosSqAlpha, cos2SigmaM, C;

        do {
            sinLambda = Math.sin(lambda);
            cosLambda = Math.cos(lambda);

            // Calculate sin(σ) using Eq. 14
            sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
                (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));

            // Check for coincident points (zero distance)
            if (sinSigma === 0) {
                return { isCoincident: true, distance: 0, initialBearing: 0 };
            }

            // Calculate cos(σ), σ, sin(α), cos²(α), cos(2σm)
            cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
            sigma = Math.atan2(sinSigma, cosSigma);
            sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
            cosSqAlpha = 1 - sinAlpha * sinAlpha;

            // cos(2σm) - handle equatorial lines
            cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
            if (isNaN(cos2SigmaM)) cos2SigmaM = 0;

            // Calculate C coefficient
            C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));

            // Update λ
            lambdaP = lambda;
            lambda = L + (1 - C) * f * sinAlpha *
                (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

        } while (Math.abs(lambda - lambdaP) > CONVERGENCE_THRESHOLD && --iterLimit > 0);

        // === Step 3: Check for convergence failure (antipodal points) ===
        if (iterLimit === 0) {
            const msg = (typeof ERROR_MESSAGES !== 'undefined')
                ? ERROR_MESSAGES.ANTIPODAL_POINTS
                : "Antipodal Limit reached (Points are nearly opposite)";
            throw new Error(msg);
        }

        // === Step 4: Compute distance using converged values ===
        const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
        const A_coeff = 1 + uSq / A_DENOM * (A_C1 + uSq * (A_C2 + uSq * (A_C3 + A_C4 * uSq)));
        const B_coeff = uSq / B_DENOM * (B_C1 + uSq * (B_C2 + uSq * (B_C3 + B_C4 * uSq)));

        const deltaSigma = B_coeff * sinSigma * (cos2SigmaM + B_coeff / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
            B_coeff / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

        // Distance = b × A × (σ - Δσ)
        const s = b * A_coeff * (sigma - deltaSigma);

        // === Step 5: Calculate initial bearing (forward azimuth) ===
        const fwdAz = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
        const initialBearing = (toDeg(fwdAz) + 360) % 360;

        return {
            distance: s,
            initialBearing: initialBearing,
            isCoincident: false
        };
    }

    // Public API
    return {
        calculateDestination,
        calculateDistance
    };
})();
