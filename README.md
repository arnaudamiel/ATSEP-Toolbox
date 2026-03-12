<img title="" src="icon-192.png" alt="Aviation Toolbox (ATSEP)" data-align="center" width="150">

# ATSEP Toolbox

**ATSEP Toolbox** is a comprehensive Progressive Web App (PWA) designed for ATC Engineers and aviation enthusiasts. It provides accurate, standards-compliant calculation tools that work completely offline.

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blue)](https://arnaudamiel.github.io/ATSEP-Toolbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

### 1. QNH Correction Calculator

* **Standards Compliant:** Calculates QNH corrections in line with the *Manual of the ICAO Standard Atmosphere (Doc 7488/3)*.
* **Dual Units:** Supports both hPa and inHg with automatic conversion.
* **Multiple Outputs:** Results in Flight Levels, feet, or meters.
* **Pressure Altitude:** Displays both pressure altitude and correction values.
* **Range Warnings:** Alerts for unusual pressure values.

### 2. Geodesic Tools (High Accuracy)

Uses **Vincenty's Formulae** on the WGS-84 ellipsoid, providing distance and bearing accuracy to within a few millimeters.

* **Range (Inverse):** Calculate the geodesic distance and initial bearing between two points.
* **Destination (Direct):** Project a new point given a starting point, distance, and bearing.
* **Linked Units:** Seamlessly switch between Nautical Miles (NM) and Meters (M) across tabs.
* **Dynamic Synchronization:** Display formats (DD, DDM, DMS) are synchronized across all tabs, with results re-rendering instantly upon change.
* **Coordinate Swap:** Quickly reverse origin and destination with one click.

### 3. Magnetic Variation (WMMHR2025)

* **Model Accuracy:** Uses the **World Magnetic Model High Resolution (WMMHR2025)** for high-precision magnetic variation calculations.
* **Secular Variation:** Provides the rate of change for magnetic declination (degrees per year).
* **Uncertainty Estimates:** Displays model uncertainty based on location and date.
* **Epoch Validation:** Includes built-in checks for model epoch validity (currently 2025 - 2030).
* **Reference:** Based on [NCEI World Magnetic Model High Resolution](https://www.ncei.noaa.gov/products/world-magnetic-model-high-resolution).

### 4. Precision GPS Averager & Geoid Separation

* **GPS Averager:** Offers a high-precision GPS averager to filter out location jitter and increase accuracy.
* **EGM96 Geoid Model:** Integrates the EGM96 geoid model to provide altitude relative to Mean Sea Level (MSL) instead of standard WGS-84 GPS height.
* **Height Unit Selection:** Supports toggling between Meters (0.1m precision) and Feet (rounded to nearest integer) for all altitude, geoid, and accuracy metrics.
* **Smart Device Detection:** Automatically bypasses manual geoid corrections on iOS devices which natively calculate MSL, avoiding double corrections.

### 5. Seamless Interaction

* **Click-and-Hold to Copy:** Professional interface designed for speed. Simply hold down a mouse click or long-press a result field for 1 second to copy it to the clipboard, accompanied by a visual confirmation flash.
* **Auto-Save:** All settings and inputs are automatically persisted in local storage.

## Usage

The application is a **Progressive Web App (PWA)**.

* **Online:** Visit the hosted page at [arnaudamiel.github.io/ATSEP-Toolbox](https://arnaudamiel.github.io/ATSEP-Toolbox)
* **Offline:** Install it to your home screen on iOS or Android to use it anywhere, even without an internet connection.

### Installation

**On Mobile (iOS/Android):**

1. Open the website in your browser
2. Tap the "Share" or menu button
3. Select "Add to Home Screen"
4. The app icon will appear on your home screen

**On Desktop (Chrome/Edge):**

1. Open the website
2. Click the install icon in the address bar (or menu → "Install ATSEP Toolbox")

---

## Technical Details

### Architecture

The application follows a modular design with clear separation of concerns:

```
ATSEP-Toolbox/
├── index.html      # Main HTML structure with semantic markup
├── style.css       # Design system with CSS custom properties
├── constants.js    # Shared physical constants and conversion factors
├── Vincenty.js     # WGS-84 geodesic calculations (Vincenty's formulae)
├── QNH.js          # ICAO Standard Atmosphere calculations
├── wmmhr.js        # WMMHR2025 magnetic model implementation
├── WMMHR.COF.gz    # High-resolution magnetic model coefficients (compressed)
├── EGM96.js        # EGM96 geoid calculation module
├── WW15MGH.GRD.gz  # EGM96 interpolation grid data (compressed)
├── ui/             # Feature-specific ES modules for UI
│   ├── shared-ui.js
│   ├── qnh-ui.js
│   ├── range-ui.js
│   ├── dest-ui.js
│   ├── magvar-ui.js
│   └── gps-ui.js
├── ui.js           # Main ES module entry point
├── app.js          # PWA service worker registration
├── sw.js           # Service worker for offline support
├── manifest.json   # PWA manifest with shortcuts
└── tests/          # Unit tests for calculation modules
```

### Module Overview

| Module         | Purpose                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `constants.js` | Centralized physical constants (WGS-84, ICAO atmosphere), conversion factors, and error messages |
| `Vincenty.js`  | Pure geodesic calculations - no dependencies on UI                                               |
| `QNH.js`       | Pure atmospheric calculations - no dependencies on UI                                            |
| `wmmhr.js`     | World Magnetic Model High Resolution calculations                                                |
| `EGM96.js`     | EGM96 Geoid Separation calculations                                                              |
| `ui/`          | Directory containing feature-isolated ES modules for UI controllers (`qnh-ui.js`, etc.)          |
| `ui.js`        | Main ES module entry point that orchestrates the UI modules and global DOM listeners             |
| `app.js`       | Service worker registration only                                                                 |

### Standards and Models Compliance

| Standard            | Application                                             |
| ------------------- | ------------------------------------------------------- |
| **ICAO Doc 7488/3** | Standard Atmosphere parameters for QNH calculations     |
| **WGS-84**          | World Geodetic System 1984 ellipsoid parameters         |
| **Vincenty 1975**   | Iterative geodesic formulae for sub-millimeter accuracy |
| **WMMHR2025**       | High-definition magnetic field model (up to degree 133) |
| **EGM96**           | Earth Gravitational Model 1996 for geoid separation     |

---

## Development

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- A local web server for development

### Running Locally

```bash
# Clone the repository
git clone https://github.com/arnaudamiel/ATSEP-Toolbox.git
cd ATSEP-Toolbox

# Start a local server (Python 3)
python -m http.server 8000

# Or using Node.js
npx serve .

# Open in browser
# http://localhost:8000
```

### Testing

Open `tests/test.html` in a browser to run the unit tests for QNH and Vincenty modules.

```bash
# Quick test with Python server
python -m http.server 8000
# Then open http://localhost:8000/tests/test.html
```

### Browser Support

| Browser | Minimum Version |
| ------- | --------------- |
| Chrome  | 80+             |
| Firefox | 78+             |
| Safari  | 14+             |
| Edge    | 80+             |

### Accessibility

The application implements:

- ARIA roles and labels for screen readers
- Keyboard navigation support
- Reduced motion support for users who prefer less animation
- High contrast mode support
- Focus indicators for all interactive elements

---

## Contributing

Contributions are welcome! Please ensure any PRs:

1. Maintain the existing code style
2. Include appropriate JSDoc comments
3. Don't break offline functionality
4. Preserve the accuracy of safety-critical calculations
5. Update tests if modifying calculation logic

### Code Style

- 
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for all public functions
- Keep calculation modules (QNH.js, Vincenty.js) free of UI logic

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Links

- **Live Application:** [arnaudamiel.github.io/ATSEP-Toolbox](https://arnaudamiel.github.io/ATSEP-Toolbox)
- **GitHub Repository:** [github.com/arnaudamiel/ATSEP-Toolbox](https://github.com/arnaudamiel/ATSEP-Toolbox)

---

## Acknowledgments

- Thaddeus Vincenty for the geodesic formulae
- ICAO for the Standard Atmosphere documentation
- The USA tax payers for their contribution to the various earth models
- The aviation community for feedback and testing
