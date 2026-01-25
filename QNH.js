/**
 * QNH.js
 * Pure Standard Atmosphere Calculation Module.
 * 
 * Calculates altitude corrections based on QNH (barometric pressure at sea level).
 * Implements the barometric formula as defined in the ICAO Standard Atmosphere.
 * 
 * References:
 * - Manual of the ICAO Standard Atmosphere (Doc 7488/3)
 * - U.S. Standard Atmosphere, 1976
 * 
 * @module QNH
 * @author ATSEP Toolbox
 */

const QNH = (function () {
    // Use shared constants if available, otherwise use local definitions
    const STANDARD_PRESSURE_HPA = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.STANDARD_PRESSURE_HPA : 1013.25;
    const INHG_TO_HPA = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.INHG_TO_HPA : 33.86389;
    const FEET_TO_METERS = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.FEET_TO_METERS : 0.3048;

    /** Sea level standard temperature in Kelvin (15°C) */
    const T0 = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.STANDARD_TEMP_K : 288.15;

    /** Standard temperature lapse rate in K/m (6.5 K/km) */
    const L = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.TEMP_LAPSE_RATE : 0.0065;

    /** Gravitational acceleration in m/s² */
    const g = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.GRAVITY : 9.80665;

    /** Specific gas constant for dry air in J/(kg·K) */
    const Rs = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.GAS_CONSTANT_DRY_AIR : 287.05287;

    /** Pressure limits for validation */
    const PRESSURE_LIMITS_HPA = (typeof ATSEP_CONSTANTS !== 'undefined')
        ? ATSEP_CONSTANTS.PRESSURE_LIMITS_HPA
        : {
            hardMin: 850,
            hardMax: 1100,
            warningMin: 920,
            warningMax: 1060
        };

    /**
     * Calculates the altitude correction based on QNH pressure.
     * 
     * The barometric (hypsometric) formula relates pressure and altitude:
     * h = (T0 / L) × [(P0/P)^(R×L/g) - 1]
     * 
     * Where:
     * - T0 = Standard sea level temperature (288.15 K)
     * - L = Standard lapse rate (0.0065 K/m)
     * - P0 = Standard pressure (1013.25 hPa)
     * - P = Actual pressure (QNH)
     * - R = Specific gas constant for dry air (287.05287 J/(kg·K))
     * - g = Gravitational acceleration (9.80665 m/s²)
     * 
     * The "correction" represents the difference between indicated altitude
     * (assuming standard pressure) and true altitude. A negative correction
     * means the aircraft is lower than indicated (low pressure = low altitude).
     * 
     * @param {number} rawValue - The input pressure value
     * @param {string} inputUnit - Input unit: 'hPa' or 'inHg'
     * @param {string} outputUnit - Output unit: 'FL' (flight level), 'feet', or 'meters'
     * @returns {Object} Result object with properties:
     *   - correction: The altitude correction value
     *   - pressureAltitude: The pressure altitude (altitude at standard pressure)
     *   - unit: The unit string for display
     *   - warning: True if pressure is in abnormal range
     *   - error: True if calculation failed
     *   - msg: Error message if error is true
     * 
     * @example
     * // Calculate correction for QNH 1000 hPa
     * const result = QNH.calculate(1000, 'hPa', 'feet');
     * // result.correction will be negative (altitude is lower than indicated)
     */
    function calculate(rawValue, inputUnit, outputUnit) {
        // Validate input
        if (isNaN(rawValue) || rawValue <= 0) {
            const msg = (typeof ERROR_MESSAGES !== 'undefined')
                ? ERROR_MESSAGES.INVALID_PRESSURE
                : "Invalid pressure value";
            return { error: true, msg: msg };
        }

        // Convert to hPa if necessary
        let pressureInHPa = (inputUnit === 'inHg') ? rawValue * INHG_TO_HPA : rawValue;

        // Validate pressure range
        if (pressureInHPa < PRESSURE_LIMITS_HPA.hardMin || pressureInHPa > PRESSURE_LIMITS_HPA.hardMax) {
            const msg = (typeof ERROR_MESSAGES !== 'undefined')
                ? ERROR_MESSAGES.PRESSURE_OUT_OF_RANGE
                : "Pressure outside realistic limits";
            return { error: true, msg: msg };
        }

        // Check for warning range (unusual but not impossible)
        let warning = false;
        if (pressureInHPa < PRESSURE_LIMITS_HPA.warningMin || pressureInHPa > PRESSURE_LIMITS_HPA.warningMax) {
            warning = true;
        }

        /**
         * Calculate pressure altitude using the barometric formula.
         * 
         * The exponent (Rs * L / g) ≈ 0.190263 represents the relationship
         * between pressure ratio and altitude in the troposphere.
         * 
         * A QNH lower than standard (1013.25 hPa) means:
         * - Actual pressure is low
         * - Aircraft is LOWER than indicated
         * - Correction is NEGATIVE (subtract from indicated altitude)
         * 
         * A QNH higher than standard means:
         * - Actual pressure is high
         * - Aircraft is HIGHER than indicated
         * - Correction is POSITIVE (add to indicated altitude)
         */
        const correctionInFeet = ((pressureInHPa / STANDARD_PRESSURE_HPA) ** (Rs * L / g) - 1) * (T0 / L / FEET_TO_METERS);

        let finalCorrection;
        let finalPA; // Pressure Altitude
        let finalUnit;

        // Convert to requested output unit
        if (outputUnit === 'FL') {
            // Flight Level: hundreds of feet
            finalCorrection = Math.round(correctionInFeet / 100);
            finalPA = Math.round((-correctionInFeet) / 100);
            finalUnit = 'FL';
        } else if (outputUnit === 'feet') {
            finalCorrection = Math.round(correctionInFeet);
            finalPA = Math.round(-correctionInFeet);
            finalUnit = 'ft';
        } else if (outputUnit === 'meters') {
            finalCorrection = Math.round(correctionInFeet * FEET_TO_METERS);
            finalPA = Math.round(-correctionInFeet * FEET_TO_METERS);
            finalUnit = 'm';
        }

        return {
            correction: finalCorrection,
            pressureAltitude: finalPA,
            unit: finalUnit,
            warning: warning,
            error: false
        };
    }

    // Public API
    return {
        calculate,
        // Expose constants for use by other modules
        INHG_TO_HPA: INHG_TO_HPA,
        STANDARD_PRESSURE_HPA: STANDARD_PRESSURE_HPA
    };
})();
