/**
 * 07_zonal_stats.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Analysis II — Zonal Statistics
 * Owner:  Team Member D
 *
 * Computes area statistics (km², %) for each risk class within the user AOI,
 * plus per-factor contribution ranking to help users understand risk drivers.
 */

/**
 * Compute area breakdown (km² and %) for each risk class within the AOI.
 * @param {ee.Image}    classified - 'risk_class' image (1=Low, 2=Med, 3=High)
 * @param {ee.Geometry} aoi        - User-defined area of interest
 * @returns {ee.Dictionary} {high:{area,pct}, medium:{area,pct}, low:{area,pct}, total}
 */
function computeZonalStats(classified, aoi) {
  var pixelArea = ee.Image.pixelArea().divide(1e6); // → km²

  function areaForClass(classVal) {
    return pixelArea
      .updateMask(classified.eq(classVal))
      .reduceRegion({
        reducer:    ee.Reducer.sum(),
        geometry:   aoi,
        scale:      500,
        maxPixels:  1e10,
        bestEffort: true
      })
      .getNumber('area');
  }

  var highArea = areaForClass(3);
  var medArea  = areaForClass(2);
  var lowArea  = areaForClass(1);
  var total    = highArea.add(medArea).add(lowArea);

  // Avoid division by zero for tiny / empty AOIs
  var safeTotal = total.max(1e-10);

  return ee.Dictionary({
    high:   ee.Dictionary({ area: highArea, pct: highArea.divide(safeTotal).multiply(100) }),
    medium: ee.Dictionary({ area: medArea,  pct: medArea.divide(safeTotal).multiply(100)  }),
    low:    ee.Dictionary({ area: lowArea,  pct: lowArea.divide(safeTotal).multiply(100)  }),
    total:  total
  });
}

/**
 * Compute mean WRI score and per-factor mean values within the AOI.
 * Useful for the inspector summary panel.
 * @param {ee.Image}    normBands - Multi-band normalised stack (VDI,LST,PA,WS,SLOPE,HFD)
 * @param {ee.Image}    wri       - Single-band WRI image
 * @param {ee.Geometry} aoi
 * @returns {ee.Dictionary} Mean value per band + overall WRI mean
 */
function computeFactorMeans(normBands, wri, aoi) {
  var allBands = normBands.addBands(wri);
  return allBands.reduceRegion({
    reducer:    ee.Reducer.mean(),
    geometry:   aoi,
    scale:      1000,
    maxPixels:  1e9,
    bestEffort: true
  });
}

exports.computeZonalStats  = computeZonalStats;
exports.computeFactorMeans = computeFactorMeans;
