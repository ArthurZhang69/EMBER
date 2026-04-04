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

/**
 * Compute the Wildfire Risk Index.
 * WRI = w1·VDI + w2·LST + w3·PA + w4·WS + w5·SLOPE + w6·HFD
 * Weights are auto-normalised so they always sum to 1.
 * @param {ee.Image} normBands - Multi-band image with bands: VDI, LST, PA, WS, SLOPE, HFD
 * @param {Object}  weights    - {w1, w2, w3, w4, w5, w6} raw (un-normalised) weights
 * @returns {ee.Image} Single-band 'WRI' image clamped to [0, 1]
 */
function computeWRI(normBands, weights) {
  // Auto-normalise weights so they sum to 1
  var total = weights.w1 + weights.w2 + weights.w3 +
              weights.w4 + weights.w5 + weights.w6;
  var w = {
    w1: weights.w1 / total,
    w2: weights.w2 / total,
    w3: weights.w3 / total,
    w4: weights.w4 / total,
    w5: weights.w5 / total,
    w6: weights.w6 / total
  };

  var wri = normBands.select('VDI').multiply(w.w1)
    .add(normBands.select('LST').multiply(w.w2))
    .add(normBands.select('PA').multiply(w.w3))
    .add(normBands.select('WS').multiply(w.w4))
    .add(normBands.select('SLOPE').multiply(w.w5))
    .add(normBands.select('HFD').multiply(w.w6));

  return wri.clamp(0, 1).rename('WRI');
}

/**
 * Compute Historical Fire Density (HFD) from FIRMS imagery.
 * Counts the number of images in which each pixel recorded an active fire
 * (T21 > 0), then applies a Gaussian kernel to spread local density, and
 * clips the result to the AOI.
 * @param {ee.ImageCollection} firms - FIRMS historical collection (T21 band)
 * @param {ee.Geometry}        aoi
 * @returns {ee.Image} Raw (un-normalised) fire-density image
 */
function computeHFD(firms, aoi) {
  // Binary fire presence per image (T21 > 0 → active fire)
  var fireBinary = firms.map(function(img) {
    return img.select('T21').gt(0).rename('fire')
              .copyProperties(img, ['system:time_start']);
  });

  // Cumulative fire count per pixel over the historical period
  var fireCount = fireBinary.sum().clip(aoi);

  // Gaussian kernel smoothing (radius 5 km) to represent local density
  var kernel    = ee.Kernel.gaussian({radius: 5000, sigma: 2000, units: 'meters', normalize: true});
  var hfd       = fireCount.convolve(kernel).rename('HFD');

  return hfd;
}

/**
 * Compute terrain slope from SRTM DEM.
 * @param {ee.Image} srtm - SRTM elevation image
 * @returns {ee.Image} Slope image in degrees, renamed 'SLOPE'
 */
function computeSlope(srtm) {
  return ee.Terrain.slope(srtm).rename('SLOPE');
}

exports.computeWRI   = computeWRI;
exports.computeHFD   = computeHFD;
exports.computeSlope = computeSlope;
