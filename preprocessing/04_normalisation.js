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

/**
 * Normalise a single-band image to [0, 1] using min-max scaling.
 * Clips outliers at the 1st and 99th percentile before scaling.
 * @param {ee.Image}    image  - Single-band ee.Image
 * @param {ee.Geometry} aoi    - Region used to compute percentiles
 * @param {number}      [scale=1000] - Pixel scale for reduceRegion (metres)
 * @returns {ee.Image} Normalised image clamped to [0, 1]
 */
function normalise(image, aoi, scale) {
  scale = scale || 1000;

  var bandName = ee.String(image.bandNames().get(0));

  // Compute 1st and 99th percentiles over the AOI
  var percentiles = image.reduceRegion({
    reducer:   ee.Reducer.percentile([1, 99]),
    geometry:  aoi,
    scale:     scale,
    maxPixels: 1e9,
    bestEffort: true
  });

  var p1  = ee.Number(percentiles.get(bandName.cat('_p1')));
  var p99 = ee.Number(percentiles.get(bandName.cat('_p99')));

  // Avoid division by zero when p1 == p99 (uniform surface)
  var range = p99.subtract(p1).max(1e-10);

  var normed = image.clamp(p1, p99)
                    .subtract(p1)
                    .divide(range)
                    .clamp(0, 1)
                    .rename(bandName);

  return normed;
}

/**
 * Normalise all six risk-factor bands and stack them into one multi-band image.
 * Bands in output image: VDI, LST, PA, WS, SLOPE, HFD
 * @param {Object}      bands  - {vdi, lst, pa, ws, slope, hfd} single-band images
 * @param {ee.Geometry} aoi
 * @returns {ee.Image} Multi-band normalised image
 */
function buildNormStack(bands, aoi) {
  var vdi   = normalise(bands.vdi.rename('VDI'),     aoi);
  var lst   = normalise(bands.lst.rename('LST'),     aoi);
  var pa    = normalise(bands.pa.rename('PA'),       aoi);
  var ws    = normalise(bands.ws.rename('WS'),       aoi);
  var slope = normalise(bands.slope.rename('SLOPE'), aoi);
  var hfd   = normalise(bands.hfd.rename('HFD'),     aoi);

  return vdi.addBands(lst)
            .addBands(pa)
            .addBands(ws)
            .addBands(slope)
            .addBands(hfd);
}

exports.normalise      = normalise;
exports.buildNormStack = buildNormStack;
