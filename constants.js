/**
 * constants.js
 * Shared constants for ATSEP Toolbox
 * 
 * This module centralizes all physical constants and conversion factors
 * used across the application to ensure consistency and maintainability.
 */

const ATSEP_CONSTANTS = Object.freeze({
    // === Pressure Conversion ===
    /** Standard conversion factor: inches of mercury to hectopascals */
    INHG_TO_HPA: 33.86389,
    /** Standard conversion factor: hectopascals to inches of mercury */
    HPA_TO_INHG: 1 / 33.86389,
    
    // === Distance Conversion ===
    /** Meters per nautical mile (international definition) */
    METERS_PER_NM: 1852,
    /** Nautical miles per meter */
    NM_PER_METER: 1 / 1852,
    
    // === Altitude Conversion ===
    /** Feet to meters conversion factor */
    FEET_TO_METERS: 0.3048,
    /** Meters to feet conversion factor */
    METERS_TO_FEET: 1 / 0.3048,
    
    // === ICAO Standard Atmosphere (Doc 7488/3) ===
    /** Standard sea level pressure in hPa */
    STANDARD_PRESSURE_HPA: 1013.25,
    /** Standard sea level temperature in Kelvin */
    STANDARD_TEMP_K: 288.15,
    /** Standard temperature lapse rate in K/m */
    TEMP_LAPSE_RATE: 0.0065,
    /** Gravitational acceleration in m/s² */
    GRAVITY: 9.80665,
    /** Specific gas constant for dry air in J/(kg·K) */
    GAS_CONSTANT_DRY_AIR: 287.05287,
    
    // === WGS-84 Ellipsoid Constants ===
    /** Semi-major axis (equatorial radius) in meters */
    WGS84_A: 6378137.0,
    /** Semi-minor axis (polar radius) in meters */
    WGS84_B: 6356752.314245,
    /** Flattening */
    WGS84_F: 1 / 298.257223563,
    
    // === Vincenty Algorithm Parameters ===
    /** Convergence threshold for iterative calculations */
    VINCENTY_CONVERGENCE: 1e-12,
    /** Maximum iterations before declaring non-convergence */
    VINCENTY_MAX_ITERATIONS: 100,
    
    // === Vincenty Expansion Coefficients (Helmert's series) ===
    /** These are numerators of the Taylor series expansion for geodesic distance */
    VINCENTY_A_DENOM: 16384,
    VINCENTY_A_C1: 4096,
    VINCENTY_A_C2: -768,
    VINCENTY_A_C3: 320,
    VINCENTY_A_C4: -175,
    VINCENTY_B_DENOM: 1024,
    VINCENTY_B_C1: 256,
    VINCENTY_B_C2: -128,
    VINCENTY_B_C3: 74,
    VINCENTY_B_C4: -47,
    
    // === Pressure Limits for QNH ===
    PRESSURE_LIMITS_HPA: Object.freeze({
        hardMin: 850,
        hardMax: 1100,
        warningMin: 920,
        warningMax: 1060
    }),
    
    // === UI Constants ===
    /** Debounce delay for input saving in milliseconds */
    DEBOUNCE_DELAY_MS: 300,
    /** Easter egg reveal delay in milliseconds */
    EASTER_EGG_DELAY_MS: 10000
});

/**
 * Standardized error messages for the application
 */
const ERROR_MESSAGES = Object.freeze({
    INVALID_PRESSURE: 'Please enter a valid positive pressure value.',
    PRESSURE_OUT_OF_RANGE: 'Pressure outside realistic limits (850-1100 hPa).',
    INVALID_COORDINATE: 'Invalid coordinate value.',
    INVALID_NUMBER: 'Must be a number.',
    ANTIPODAL_POINTS: 'Calculation failed: Points are nearly antipodal (opposite sides of Earth).',
    CONVERGENCE_FAILED: 'Calculation failed: Formula did not converge.',
    NEGATIVE_RANGE: 'Range cannot be negative.',
    INVALID_BEARING: 'Bearing must be between -360° and +360°.',
    LATITUDE_RANGE: 'Latitude must be between -90° and +90°.',
    LONGITUDE_RANGE: 'Longitude must be between -180° and +180°.',
    STORAGE_UNAVAILABLE: 'Local storage is unavailable. Settings will not persist.'
});

/**
 * Storage keys for localStorage
 */
const STORAGE_KEYS = Object.freeze({
    ACTIVE_TAB: 'active_tab',
    COORD_FMT: 'coord_fmt',
    RANGE_UNIT: 'range_unit_type',
    DEST_UNIT: 'd_unit'
});
