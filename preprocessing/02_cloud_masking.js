/**
 * 02_cloud_masking.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 * Module: Preprocessing I — Cloud Masking & Seasonal Composites
 *
 * 
 * 
 * 
 * 
 * 
 */

/**
 * 通用 MODIS QA 云掩膜（自动识别 NDVI 或 LST）
 * MOD13Q1 SummaryQA: 0=好, 1=边缘 → 保留
 * MOD11A1 QC_Day:    bits 0-1 = 00/01 → 保留
 */
function applyModisCloudMask(image) {
  var bandNames = image.bandNames();

  var masked = ee.Algorithms.If(
    bandNames.contains('SummaryQA'),
    // NDVI 路径
    (function() {
      var qa   = image.select('SummaryQA');
      var good = qa.lte(1);
      return image.select('NDVI').updateMask(good);
    })(),
    // LST 路径
    (function() {
      var qc   = image.select('QC_Day');
      var bits = qc.bitwiseAnd(3);
      var good = bits.lte(1);
      return image.select('LST_Day_1km').updateMask(good);
    })()
  );

  return ee.Image(masked).copyProperties(image, ['system:time_start']);
}

/**
 * 掩膜水体和永久冰雪
 * 
 * 
 */
function maskWaterAndIce(image) {
  // 尝试30%阈值比原来的50%更严格，覆盖季节性河流
  var jrc       = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');
  var waterMask = jrc.select('occurrence').lt(30)
                     .unmask(1); 

  //  使用MCD12Q1 土地覆盖
  var lc      = ee.ImageCollection('MODIS/061/MCD12Q1')
                  .filterDate('2020-01-01', '2021-01-01')
                  .first()
                  .select('LC_Type1');
  var iceMask = lc.neq(15);  // IGBP class 15 = 永久冰雪

  return image.updateMask(waterMask).updateMask(iceMask);
}

/**
 * 构建云掩膜季节中位数合成图
 */
function buildComposite(collection, applyTerrainMask) {
  var masked    = collection.map(applyModisCloudMask);
  var composite = masked.median();
  if (applyTerrainMask) {
    composite = maskWaterAndIce(composite);
  }
  return composite;
}

exports.applyModisCloudMask = applyModisCloudMask;
exports.maskWaterAndIce     = maskWaterAndIce;
exports.buildComposite      = buildComposite;