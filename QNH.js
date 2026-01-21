/**
 * QNH.js
 * Pure Standard Atmosphere Calculation Module.
 * Contains no UI logic.
 */

const QNH = (function () {
    /**
     * Standard Constants
     * As published by ICAO in Manual of the ICAO Standard Atmosphere, Doc 7488/3
     */
    const STANDARD_PRESSURE_HPA = 1013.25;
    const INHG_TO_HPA = 33.86389;
    const FEET_TO_METERS = 0.3048;

    const T0 = 288.15; // Sea level standard temperature in K;
    const L = 0.0065; // Standard temperature lapse rate in K/m
    const g = 9.80665; // Gravitational acceleration in m/s^2
    const Rs = 287.05287; // Specific gas constant for dry air in J/(kg . K)

    const PRESSURE_LIMITS_HPA = {
        hardMin: 850,
        hardMax: 1100,
        warningMin: 920,
        warningMax: 1060
    };

    /**
     * Calculates the Altitude correction based on QNH pressure.
     * @param {number} rawValue - The input pressure value
     * @param {string} inputUnit - 'hPa' or 'inHg'
     * @param {string} outputUnit - 'FL', 'feet', or 'meters'
     * @returns {Object} { correction, unit, error, warning }
     */
    function calculate(rawValue, inputUnit, outputUnit) {
        if (isNaN(rawValue) || rawValue <= 0) {
            return { error: true, msg: "Invalid pressure value" };
        }

        let pressureInHPa = (inputUnit === 'inHg') ? rawValue * INHG_TO_HPA : rawValue;

        if (pressureInHPa < PRESSURE_LIMITS_HPA.hardMin || pressureInHPa > PRESSURE_LIMITS_HPA.hardMax) {
            return { error: true, msg: "Pressure outside realistic limits" };
        }

        let warning = false;
        if (pressureInHPa < PRESSURE_LIMITS_HPA.warningMin || pressureInHPa > PRESSURE_LIMITS_HPA.warningMax) {
            warning = true;
        }

        // Barometric formula
        let correctionInFeet = ((pressureInHPa / STANDARD_PRESSURE_HPA) ** (Rs * L / g) - 1) * (T0 / L / FEET_TO_METERS);
        let finalCorrection;
        let finalUnit;

        if (outputUnit === 'FL') {
            finalCorrection = Math.round(correctionInFeet / 100);
            finalUnit = 'FL';
        } else if (outputUnit === 'feet') {
            finalCorrection = Math.round(correctionInFeet);
            finalUnit = 'ft';
        } else if (outputUnit === 'meters') {
            finalCorrection = Math.round(correctionInFeet * FEET_TO_METERS);
            finalUnit = 'm';
        }

        return {
            correction: finalCorrection,
            unit: finalUnit,
            warning: warning,
            error: false
        };
    }

    return {
        calculate
    };
})();
