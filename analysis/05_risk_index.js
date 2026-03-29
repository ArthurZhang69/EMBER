/**
 * 05_risk_index.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Analysis I — Weighted Composite WRI Calculation
 * Owner:  Team Member C
 *
 * Implements the core WRI formula:
 *   WRI = w1·VDI + w2·LST + w3·PA + w4·WS + w5·SLOPE + w6·HFD
 * Accepts dynamic weights from UI sliders; auto-normalises weights to sum = 1.
 * Also computes Historical Fire Density (HFD) via kernel density estimation.
 */

// ── Placeholder — implementation in progress ──────────────────────────────────

/**
 * Compute the Wildfire Risk Index.
 * @param {ee.Image} normBands - Multi-band image with all normalised factors
 * @param {Object}  weights    - {w1, w2, w3, w4, w5, w6} (will be auto-normalised)
 * @returns {ee.Image} Single-band WRI image in range [0, 1]
 */
function computeWRI(normBands, weights) {
  // TODO: implement weighted composite
}

/**
 * Compute Historical Fire Density from FIRMS point data.
 * @param {ee.ImageCollection} firms - FIRMS fire radiative power collection
 * @param {ee.Geometry}        aoi   - Area of interest
 * @returns {ee.Image} Normalised fire density image
 */
function computeHFD(firms, aoi) {
  // TODO: implement kernel density + normalisation
}

exports.computeWRI = computeWRI;
exports.computeHFD = computeHFD;
