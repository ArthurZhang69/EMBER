/**
 * 02_cloud_masking.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Preprocessing I — Cloud Masking & Seasonal Composites
 * Owner:  Team Member A
 *
 * Applies QA-based cloud masking to MODIS NDVI and LST, masks water bodies
 * (JRC Global Surface Water) and permanent snow/ice, then generates
 * median seasonal composites.
 */

/**
 * Apply MODIS QA-based cloud mask.
 * Works for both MOD13Q1 (SummaryQA) and MOD11A1 (QC_Day).
 *   MOD13Q1 SummaryQA: 0 = good, 1 = marginal  → keep 0 & 1
 *   MOD11A1 QC_Day:    bits 0-1 = 00 or 01      → keep where bits 0-1 <= 1
 * @param {ee.Image} image - MODIS image containing 'SummaryQA' or 'QC_Day'
 * @returns {ee.Image} Cloud-masked data image (QA band dropped)
 */
function applyModisCloudMask(image) {
  var bandNames = image.bandNames();

  // MOD13Q1 path — SummaryQA (0=good, 1=marginal, 2=snow/ice, 3=cloud)
  var masked = ee.Algorithms.If(
    bandNames.contains('SummaryQA'),
    (function() {
      var qa   = image.select('SummaryQA');
      var good = qa.lte(1);                        // keep good + marginal
      return image.select('NDVI').updateMask(good);
    })(),
    // MOD11A1 path — QC_Day bits 0-1: 00=good, 01=other quality
    (function() {
      var qc   = image.select('QC_Day');
      var bits = qc.bitwiseAnd(3);                 // extract bits 0-1
      var good = bits.lte(1);
      return image.select('LST_Day_1km').updateMask(good);
    })()
  );

  return ee.Image(masked).copyProperties(image, ['system:time_start']);
}

/**
 * Mask permanent water bodies and snow/ice from an image.
 * Uses JRC Global Surface Water (occurrence ≥ 50 % = permanent water)
 * and MODIS MCD12Q1 land cover (IGBP class 15 = permanent snow/ice).
 * @param {ee.Image} image - Single-band or multi-band image to mask
 * @returns {ee.Image} Masked image
 */
function maskWaterAndIce(image) {
  // JRC Global Surface Water — mask pixels that are water ≥50 % of the time
  var jrc        = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
  var waterMask  = jrc.select('occurrence').lt(50)
                      .unmask(1);                  // treat no-data as non-water

  // MODIS land cover 2020 — IGBP class 15 = snow & ice
  var lc         = ee.ImageCollection('MODIS/061/MCD12Q1')
                     .filterDate('2020-01-01', '2021-01-01')
                     .first()
                     .select('LC_Type1');
  var iceMask    = lc.neq(15);

  return image.updateMask(waterMask).updateMask(iceMask);
}

/**
 * Build cloud-masked, terrain-masked seasonal median composite.
 * @param {ee.ImageCollection} collection        - MODIS NDVI or LST collection
 * @param {boolean}            applyTerrainMask  - Whether to apply water/ice mask
 * @returns {ee.Image} Median composite image
 */
function buildComposite(collection, applyTerrainMask) {
  var masked = collection.map(applyModisCloudMask);
  var composite = masked.median();
  if (applyTerrainMask) {
    composite = maskWaterAndIce(composite);
  }
  return composite;
}

exports.applyModisCloudMask = applyModisCloudMask;
exports.maskWaterAndIce     = maskWaterAndIce;
exports.buildComposite      = buildComposite;
