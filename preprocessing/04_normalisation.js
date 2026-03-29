/**
 * 04_normalisation.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Preprocessing II — Min-Max Normalisation
 * Owner:  Team Member B
 *
 * Normalises all risk factor bands to 0-1 using min-max scaling with
 * 99th-percentile clipping to handle outliers. Outputs a multi-band
 * composite image for consumption by the Analysis modules.
 */

// ── Placeholder — implementation in progress ──────────────────────────────────

/**
 * Normalise an image band to [0, 1] with 99th-percentile clipping.
 * @param {ee.Image}    image  - Single-band image to normalise
 * @param {ee.Geometry} aoi    - Region for percentile computation
 * @returns {ee.Image} Normalised image in range [0, 1]
 */
function normalise(image, aoi) {
  // TODO: implement min-max normalisation with percentile clipping
}

exports.normalise = normalise;
