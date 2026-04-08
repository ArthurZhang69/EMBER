/**
 * 03_anomaly_calculation.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 * Module: Preprocessing II — Climate Anomaly Calculation
 *
 * 更改：
 * 
 * - 基准期缩短为 5 年（2018-01-01 至 2022-12-31）尝试提升性能水平
 *   减少数据处理量，同时保持统计代表性
 */

// ── 基准期常量（统一在此修改）─────────────────────────────────────────────────
var BASELINE_START = '2018-01-01';
var BASELINE_END   = '2022-12-31';

/**
 * 计算 LST 异常：当前均值 - 5年基准均值（单位：Kelvin）
 */
function computeLSTAnomaly(lstCollection, start, end, aoi) {
  var startMonth = ee.Date(start).get('month');
  var endMonth   = ee.Date(end).get('month');

  var toKelvin = function(img) {
    return img.select('LST_Day_1km')
              .multiply(0.02)
              .rename('LST_K')
              .copyProperties(img, ['system:time_start']);
  };

  var currentMean = lstCollection.map(toKelvin).mean();

  // 基准期缩短为 5 年
  var baseline = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterBounds(aoi)
    .filterDate(BASELINE_START, BASELINE_END)
    .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
    .map(toKelvin)
    .mean();

  return currentMean.subtract(baseline).rename('LST_anomaly');
}

/**
 * 计算降水亏缺：5年基准均值 - 当前均值（正值=偏干）
 */
function computePrecipAnomaly(chirpsCollection, start, end, aoi) {
  var startMonth = ee.Date(start).get('month');
  var endMonth   = ee.Date(end).get('month');

  var currentMean = chirpsCollection.select('precipitation').mean();

  // 基准期缩短为 5 年
  var baseline = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterBounds(aoi)
    .filterDate(BASELINE_START, BASELINE_END)
    .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
    .select('precipitation')
    .mean();

  return baseline.subtract(currentMean).rename('precip_deficit');
}

/**
 * 计算 VDI 异常（植被干燥指数偏差）
 * 
 * 
 */
function computeNDVIAnomaly(ndviCollection, start, end, aoi) {
  var startMonth = ee.Date(start).get('month');
  var endMonth   = ee.Date(end).get('month');

  var toVDI = function(img) {
    var ndvi = img.select('NDVI').multiply(0.0001);
    var vdi  = ee.Image(1).subtract(ndvi.add(1).divide(2)).rename('VDI');
    return vdi.copyProperties(img, ['system:time_start']);
  };

  var currentVDI = ndviCollection.map(toVDI).mean();

  // 基准期缩短为 5 年
  var baselineVDI = ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterBounds(aoi)
    .filterDate(BASELINE_START, BASELINE_END)
    .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
    .map(toVDI)
    .mean();

  return currentVDI.subtract(baselineVDI).rename('VDI_anomaly');
}

exports.computeLSTAnomaly    = computeLSTAnomaly;
exports.computePrecipAnomaly = computePrecipAnomaly;
exports.computeNDVIAnomaly   = computeNDVIAnomaly;