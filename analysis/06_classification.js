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

/**
 * Classify a continuous WRI image into three discrete risk levels.
 *   1 = Low    (WRI  < 0.33)
 *   2 = Medium (0.33 ≤ WRI < 0.67)
 *   3 = High   (WRI ≥ 0.67)
 * @param {ee.Image} wri - Single-band 'WRI' image [0, 1]
 * @returns {ee.Image}   'risk_class' image with values 1 / 2 / 3
 */
function classifyRisk(wri) {
  var classified = ee.Image(1)            // start all pixels at Low (1)
    .where(wri.gte(0.33), 2)             // upgrade to Medium
    .where(wri.gte(0.67), 3)             // upgrade to High
    .updateMask(wri.mask())              // propagate no-data mask
    .rename('risk_class')
    .toInt8();

  return classified;
}

/**
 * Return visualisation parameters for the classified risk layer.
 * @returns {Object} vis params for Map.addLayer
 */
function classVis() {
  return {
    min:     1,
    max:     3,
    palette: ['#1a9641', '#fdae61', '#d7191c']  // green / orange / red
  };
}

/**
 * Return visualisation parameters for the continuous WRI layer.
 * @returns {Object} vis params for Map.addLayer
 */
function wriVis() {
  return {
    min:     0,
    max:     1,
    palette: ['#1a9641', '#a6d96a', '#ffffbf', '#fdae61', '#d7191c']
  };
}

exports.classifyRisk = classifyRisk;
exports.classVis     = classVis;
exports.wriVis       = wriVis;
