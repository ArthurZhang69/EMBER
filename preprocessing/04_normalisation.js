/**
 * 04_normalisation.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 * Module: Preprocessing II — Min-Max Normalisation
 *
 * 
 * 
 * 
 * 
 * 
 */

function normalise(image, aoi, scale) {
  scale = scale || 1000;

  var bandName = ee.String(image.bandNames().get(0));

  var percentiles = image.reduceRegion({
    reducer:    ee.Reducer.percentile([1, 99]),
    geometry:   aoi,
    scale:      scale,
    maxPixels:  1e9,
    bestEffort: true   
  });

  var p1  = ee.Number(percentiles.get(bandName.cat('_p1')));
  var p99 = ee.Number(percentiles.get(bandName.cat('_p99')));

  // 避免分母为零导致的异常情况
  var range = p99.subtract(p1).max(1e-10);

  // 将像素值限制在1%和99%的范围内，并进行归一化
  var normed = image.clamp(p1, p99)
                    .subtract(p1)
                    .divide(range)
                    .clamp(0, 1)
                    .rename(bandName);

  return normed;
}

/**
 * 归一化所有六个风险因子并叠加为多波段图像
 * 输出波段：VDI / LST / PA / WS / SLOPE / HFD
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