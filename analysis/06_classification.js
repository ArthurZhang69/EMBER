/**
 * 06_classification.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Analysis I — Risk Classification
 * Owner:  Team Member C
 *
 * Thresholds the continuous WRI into three discrete risk classes:
 *   High   (3): WRI >= 0.67
 *   Medium (2): 0.33 <= WRI < 0.67
 *   Low    (1): WRI < 0.33
 */

// ── Placeholder — implementation in progress ──────────────────────────────────

/**
 * Classify a continuous WRI image into High / Medium / Low risk.
 * @param {ee.Image} wri - Single-band WRI image [0, 1]
 * @returns {ee.Image}  Classified image (values: 1=Low, 2=Medium, 3=High)
 */
function classifyRisk(wri) {
  // TODO: implement thresholding logic
}

exports.classifyRisk = classifyRisk;
