/**
 * 03_anomaly_calculation.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Preprocessing II — Climate Anomaly Calculation
 * Owner:  Team Member B
 *
 * Computes LST anomaly relative to 2000-2020 long-term mean,
 * 90-day rolling precipitation deficit, and NDVI deviation from
 * multi-year same-period baseline.
 */

/**
 * Compute LST anomaly: current seasonal mean minus 2000-2020 baseline mean
 * for the same calendar months.  Result in Kelvin (positive = warmer).
 * @param {ee.ImageCollection} lstCollection - Filtered current-period MOD11A1
 * @param {string}             start         - Analysis start date 'YYYY-MM-DD'
 * @param {string}             end           - Analysis end date   'YYYY-MM-DD'
 * @param {ee.Geometry}        aoi           - Area of interest
 * @returns {ee.Image} LST anomaly image (Kelvin)
 */
function computeLSTAnomaly(lstCollection, start, end, aoi) {
  var startDate  = ee.Date(start);
  var endDate    = ee.Date(end);
  var startMonth = startDate.get('month');
  var endMonth   = endDate.get('month');

  // Scale raw DN → Kelvin
  var toKelvin = function(img) {
    return img.select('LST_Day_1km')
              .multiply(0.02)
              .rename('LST_K')
              .copyProperties(img, ['system:time_start']);
  };

  // Current-period seasonal mean
  var currentMean = lstCollection.map(toKelvin).mean();

  // 2000-2020 baseline — same calendar months
  var baseline = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterBounds(aoi)
    .filterDate('2000-01-01', '2020-12-31')
    .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
    .map(toKelvin)
    .mean();

  return currentMean.subtract(baseline).rename('LST_anomaly');
}

/**
 * Compute precipitation deficit: 2000-2020 baseline mean minus current mean.
 * Positive values indicate drier-than-average conditions.
 * @param {ee.ImageCollection} chirpsCollection - Filtered current-period CHIRPS
 * @param {string}             start            - Analysis start date
 * @param {string}             end              - Analysis end date
 * @param {ee.Geometry}        aoi              - Area of interest
 * @returns {ee.Image} Precipitation deficit image (mm/day)
 */
function computePrecipAnomaly(chirpsCollection, start, end, aoi) {
  var startMonth = ee.Date(start).get('month');
  var endMonth   = ee.Date(end).get('month');

  var currentMean = chirpsCollection.select('precipitation').mean();

  var baseline = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterBounds(aoi)
    .filterDate('2000-01-01', '2020-12-31')
    .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
    .select('precipitation')
    .mean();

  // Deficit = baseline − current (positive = less rain than normal = drier)
  return baseline.subtract(currentMean).rename('precip_deficit');
}

/**
 * Compute NDVI anomaly: current mean VDI (inverse NDVI) minus baseline.
 * Positive values indicate drier/sparser vegetation than normal.
 * @param {ee.ImageCollection} ndviCollection - Filtered current-period MOD13Q1
 * @param {string}             start
 * @param {string}             end
 * @param {ee.Geometry}        aoi
 * @returns {ee.Image} VDI anomaly image (dimensionless, scaled 0–1)
 */
function computeNDVIAnomaly(ndviCollection, start, end, aoi) {
  var startMonth = ee.Date(start).get('month');
  var endMonth   = ee.Date(end).get('month');

  var toVDI = function(img) {
    // NDVI scale factor 0.0001; VDI = 1 − NDVI_normalised
    var ndvi = img.select('NDVI').multiply(0.0001);
    var vdi  = ee.Image(1).subtract(ndvi.add(1).divide(2)).rename('VDI');
    return vdi.copyProperties(img, ['system:time_start']);
  };

  var currentVDI = ndviCollection.map(toVDI).mean();

  var baselineVDI = ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterBounds(aoi)
    .filterDate('2000-01-01', '2020-12-31')
    .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))
    .map(toVDI)
    .mean();

  return currentVDI.subtract(baselineVDI).rename('VDI_anomaly');
}

exports.computeLSTAnomaly    = computeLSTAnomaly;
exports.computePrecipAnomaly = computePrecipAnomaly;
exports.computeNDVIAnomaly   = computeNDVIAnomaly;
