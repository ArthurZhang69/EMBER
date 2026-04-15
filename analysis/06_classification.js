/**
 * 06_classification.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Analysis I — Risk Classification
 * Owner: Team Member C
 *
 * This module turns the continuous WRI surface into three explainable classes.
 * The thresholds are explicit and intentionally simple:
 *   - Low:    WRI < 0.33
 *   - Medium: 0.33 <= WRI < 0.67
 *   - High:   WRI >= 0.67
 *
 * These breaks are equal-width splits of the 0-1 normalised WRI range. They
 * are suitable for classroom presentation and cross-case comparison, but they
 * should not be presented as universal ecological tipping points.
 */

var THRESHOLDS = {
  lowMedium: 0.33,
  mediumHigh: 0.67
};

var RISK_CLASS_INFO = [
  {
    value: 1,
    key: 'low',
    label: 'Low',
    color: '#1a9641',
    rangeLabel: 'WRI < 0.33',
    description: 'Background conditions are comparatively less conducive to wildfire.'
  },
  {
    value: 2,
    key: 'medium',
    label: 'Medium',
    color: '#fdae61',
    rangeLabel: '0.33 <= WRI < 0.67',
    description: 'Mixed signals across the six factors indicate moderate concern.'
  },
  {
    value: 3,
    key: 'high',
    label: 'High',
    color: '#d7191c',
    rangeLabel: 'WRI >= 0.67',
    description: 'Multiple factors align to indicate comparatively elevated wildfire risk.'
  }
];

var WRI_VIS_PARAMS = {
  min: 0,
  max: 1,
  palette: ['#1a9641', '#a6d96a', '#ffffbf', '#fdae61', '#d7191c']
};

var CLASS_VIS_PARAMS = {
  min: 1,
  max: 3,
  palette: RISK_CLASS_INFO.map(function(info) {
    return info.color;
  })
};

/**
 * Classify a continuous WRI image into three discrete risk levels.
 *
 * @param {ee.Image} wri - single-band WRI image in [0, 1]
 * @returns {ee.Image} 'risk_class' image with values 1 / 2 / 3
 */
function classifyRisk(wri) {
  return ee.Image(1)
    .where(wri.gte(THRESHOLDS.lowMedium), 2)
    .where(wri.gte(THRESHOLDS.mediumHigh), 3)
    .updateMask(wri.mask())
    .rename('risk_class')
    .toInt8();
}

/**
 * Lightweight class summary helper for Team Member C.
 *
 * This is intentionally narrower than `07_zonal_stats.js`: it provides enough
 * class counts / areas / percentages to support C's technical walkthrough and
 * presentation, without taking over Team Member D's richer AOI analytics.
 *
 * @param {ee.Image} classified - risk class image (1=Low, 2=Medium, 3=High)
 * @param {ee.Geometry} aoi - analysis area
 * @param {number=} scale - reduction scale in metres
 * @returns {ee.Dictionary} per-class pixel count / area / percentage summary
 */
function summariseRiskClasses(classified, aoi, scale) {
  scale = scale || 1000;

  var pixelAreaKm2 = ee.Image.pixelArea().divide(1e6).rename('area');
  var pixelCount = ee.Image.constant(1).rename('pixels');

  function summariseClass(info) {
    var classMask = classified.eq(info.value);
    var stats = pixelAreaKm2.updateMask(classMask)
      .addBands(pixelCount.updateMask(classMask))
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: scale,
        maxPixels: 1e10,
        bestEffort: true
      });

    var areaKm2 = ee.Number(ee.Algorithms.If(stats.contains('area'), stats.get('area'), 0));
    var pixels = ee.Number(ee.Algorithms.If(stats.contains('pixels'), stats.get('pixels'), 0));

    return ee.Dictionary({
      label: info.label,
      classValue: info.value,
      rangeLabel: info.rangeLabel,
      areaKm2: areaKm2,
      pixelCount: pixels
    });
  }

  var low = summariseClass(RISK_CLASS_INFO[0]);
  var medium = summariseClass(RISK_CLASS_INFO[1]);
  var high = summariseClass(RISK_CLASS_INFO[2]);

  var totalAreaKm2 = ee.Number(low.get('areaKm2'))
    .add(ee.Number(medium.get('areaKm2')))
    .add(ee.Number(high.get('areaKm2')));
  var totalPixels = ee.Number(low.get('pixelCount'))
    .add(ee.Number(medium.get('pixelCount')))
    .add(ee.Number(high.get('pixelCount')));

  function addPercentages(summary) {
    summary = ee.Dictionary(summary);
    var areaKm2 = ee.Number(summary.get('areaKm2'));
    var pixels = ee.Number(summary.get('pixelCount'));
    return summary
      .set('areaPct', areaKm2.divide(totalAreaKm2.max(1e-10)).multiply(100))
      .set('pixelPct', pixels.divide(totalPixels.max(1)).multiply(100));
  }

  return ee.Dictionary({
    thresholds: ee.Dictionary(THRESHOLDS),
    low: addPercentages(low),
    medium: addPercentages(medium),
    high: addPercentages(high),
    totalAreaKm2: totalAreaKm2,
    totalPixels: totalPixels
  });
}

function classVis() {
  return CLASS_VIS_PARAMS;
}

function wriVis() {
  return WRI_VIS_PARAMS;
}

exports.THRESHOLDS = THRESHOLDS;
exports.RISK_CLASS_INFO = RISK_CLASS_INFO;
exports.classifyRisk = classifyRisk;
exports.summariseRiskClasses = summariseRiskClasses;
exports.classVis = classVis;
exports.wriVis = wriVis;
