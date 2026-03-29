/**
 * 03_anomaly_calculation.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Preprocessing II — Climate Anomaly Calculation
 * Owner:  Team Member B
 *
 * Computes LST anomaly relative to 2000-2020 long-term mean,
 * 90-day rolling precipitation deficit, and NDVI deviation from
 * multi-year same-period baseline.
 */

// ── Placeholder — implementation in progress ──────────────────────────────────

/**
 * Compute LST anomaly relative to 2000-2020 baseline.
 * @param {ee.ImageCollection} lstCollection - Filtered LST collection
 * @param {ee.Geometry}        aoi           - Area of interest
 * @returns {ee.Image} LST anomaly image
 */
function computeLSTAnomaly(lstCollection, aoi) {
  // TODO: implement LST anomaly calculation
}

/**
 * Compute 90-day rolling precipitation deficit.
 * @param {ee.ImageCollection} chirpsCollection - Filtered CHIRPS collection
 * @param {ee.Geometry}        aoi              - Area of interest
 * @returns {ee.Image} Precipitation anomaly image
 */
function computePrecipAnomaly(chirpsCollection, aoi) {
  // TODO: implement precipitation anomaly calculation
}

exports.computeLSTAnomaly    = computeLSTAnomaly;
exports.computePrecipAnomaly = computePrecipAnomaly;
