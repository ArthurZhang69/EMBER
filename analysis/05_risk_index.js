/**
 * 05_risk_index.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Analysis I — Weighted Composite WRI Calculation
 * Owner: Team Member C
 *
 * This module is the core of the wildfire analysis workflow. It:
 *   1. Defines the six factors used in the Wildfire Risk Index (WRI)
 *   2. Sanitises and normalises user-provided weights from the UI
 *   3. Builds an explainable Historical Fire Density (HFD) surface from FIRMS
 *   4. Computes a mask-aware weighted composite:
 *        WRI = w1·VDI + w2·LST + w3·PA + w4·WS + w5·SLOPE + w6·HFD
 *
 * The implementation is intentionally walkthrough-friendly:
 *   - invalid / missing / negative weights are handled safely
 *   - all-zero weights fall back to equal weighting
 *   - missing factor bands do not invalidate the whole WRI surface
 */

var FACTOR_SPECS = [
  {
    key: 'w1',
    band: 'VDI',
    label: 'Vegetation Dryness Index',
    shortLabel: 'VDI',
    description: 'Inverse NDVI proxy. Higher values indicate drier, more fire-prone vegetation.'
  },
  {
    key: 'w2',
    band: 'LST',
    label: 'Land Surface Temperature Anomaly',
    shortLabel: 'LST',
    description: 'Positive temperature anomaly relative to baseline conditions.'
  },
  {
    key: 'w3',
    band: 'PA',
    label: 'Precipitation Deficit',
    shortLabel: 'PA',
    description: 'Dryness signal derived from rainfall deficit relative to baseline conditions.'
  },
  {
    key: 'w4',
    band: 'WS',
    label: 'Wind Speed',
    shortLabel: 'WS',
    description: 'Higher wind speeds can support faster fire spread and spotting.'
  },
  {
    key: 'w5',
    band: 'SLOPE',
    label: 'Terrain Slope',
    shortLabel: 'SLOPE',
    description: 'Steeper terrain can accelerate uphill fire spread.'
  },
  {
    key: 'w6',
    band: 'HFD',
    label: 'Historical Fire Density',
    shortLabel: 'HFD',
    description: 'Kernel-smoothed density of historical FIRMS fire detections.'
  }
];

var DEFAULT_WEIGHTS = {
  w1: 1 / FACTOR_SPECS.length,
  w2: 1 / FACTOR_SPECS.length,
  w3: 1 / FACTOR_SPECS.length,
  w4: 1 / FACTOR_SPECS.length,
  w5: 1 / FACTOR_SPECS.length,
  w6: 1 / FACTOR_SPECS.length
};

function cloneWeights(weights) {
  return {
    w1: weights.w1,
    w2: weights.w2,
    w3: weights.w3,
    w4: weights.w4,
    w5: weights.w5,
    w6: weights.w6
  };
}

function toSafeWeight(value) {
  var numeric = Number(value);
  if (!isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

/**
 * Clean and normalise raw weights coming from the UI.
 *
 * Behaviour:
 *   - null / undefined / NaN / negative values become 0
 *   - if every weight resolves to 0, the function falls back to equal weights
 *   - otherwise the cleaned weights are divided by their sum so that Σw = 1
 *
 * @param {Object} rawWeights - raw weight object, expected keys: w1...w6
 * @returns {Object} stable weight object with keys w1...w6 summing to 1
 */
function normaliseWeights(rawWeights) {
  var cleaned = {};
  var total = 0;

  FACTOR_SPECS.forEach(function(spec) {
    var safeWeight = toSafeWeight(rawWeights && rawWeights[spec.key]);
    cleaned[spec.key] = safeWeight;
    total += safeWeight;
  });

  if (!(total > 0)) {
    return cloneWeights(DEFAULT_WEIGHTS);
  }

  var normalised = {};
  FACTOR_SPECS.forEach(function(spec) {
    normalised[spec.key] = cleaned[spec.key] / total;
  });

  return normalised;
}

/**
 * Build a Historical Fire Density (HFD) layer from FIRMS detections.
 *
 * Steps:
 *   1. Convert each FIRMS scene into a binary active-fire image (T21 > 0)
 *   2. Sum across the full historical record to get per-pixel fire counts
 *   3. Apply a Gaussian kernel density smoothing so nearby fire clusters are
 *      represented as local historical risk, not just single hot pixels
 *
 * HFD is returned as a raw surface because the project pipeline normalises all
 * six factors together before the final WRI composite is calculated.
 *
 * @param {ee.ImageCollection} firms - FIRMS collection covering 2000 -> endDate
 * @param {ee.Geometry} aoi - analysis area
 * @returns {ee.Image} raw HFD image, band name 'HFD'
 */
function computeHFD(firms, aoi) {
  var fireBinary = firms.map(function(img) {
    return img.select('T21')
      .gt(0)
      .rename('fire')
      .copyProperties(img, ['system:time_start']);
  });

  var fireCount = fireBinary.sum().clip(aoi);
  var kernel = ee.Kernel.gaussian({
    radius: 5000,
    sigma: 2000,
    units: 'meters',
    normalize: true
  });

  return fireCount.convolve(kernel).rename('HFD').clip(aoi);
}

/**
 * Compute the weighted Wildfire Risk Index (WRI).
 *
 * This implementation is mask-aware:
 *   - if one factor is missing at a pixel, the remaining valid factors are
 *     re-normalised automatically at that pixel
 *   - if all factors are masked at a pixel, the output is masked
 *
 * This behaviour is easier to defend in a technical walkthrough than silently
 * forcing missing bands to zero risk everywhere.
 *
 * @param {ee.Image} normBands - multi-band normalised image with VDI/LST/PA/WS/SLOPE/HFD
 * @param {Object} rawWeights - raw or already-normalised weight object with keys w1...w6
 * @returns {ee.Image} single-band WRI image in [0, 1]
 */
function computeWRI(normBands, rawWeights) {
  var weights = normaliseWeights(rawWeights);
  var numerator = ee.Image(0);
  var denominator = ee.Image(0);
  var availableBands = normBands.bandNames();

  FACTOR_SPECS.forEach(function(spec) {
    var factorImage = ee.Image(ee.Algorithms.If(
      availableBands.contains(spec.band),
      normBands.select(spec.band),
      ee.Image.constant(0).rename(spec.band).updateMask(ee.Image.constant(0))
    ));
    var safeWeight = weights[spec.key];
    var validMask = factorImage.mask().gt(0);

    numerator = numerator.add(factorImage.unmask(0).multiply(safeWeight));
    denominator = denominator.add(
      ee.Image.constant(safeWeight).updateMask(validMask).unmask(0)
    );
  });

  var safeDenominator = denominator.where(denominator.lte(0), 1e-10);

  return numerator
    .divide(safeDenominator)
    .updateMask(denominator.gt(0))
    .clamp(0, 1)
    .rename('WRI');
}

/**
 * Compute terrain slope from SRTM DEM.
 * @param {ee.Image} srtm - SRTM elevation image
 * @returns {ee.Image} slope image in degrees, renamed 'SLOPE'
 */
function computeSlope(srtm) {
  return ee.Terrain.slope(srtm).rename('SLOPE');
}

exports.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
exports.FACTOR_SPECS = FACTOR_SPECS;
exports.normaliseWeights = normaliseWeights;
exports.computeWRI = computeWRI;
exports.computeHFD = computeHFD;
exports.computeSlope = computeSlope;
