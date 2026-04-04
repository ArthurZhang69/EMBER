/**
 * 01_data_import.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Preprocessing I — Data Import & Temporal Filtering
 * Owner:  Team Member A
 *
 * Loads and filters all six GEE datasets (MODIS NDVI, MODIS LST, CHIRPS,
 * ERA5-Land, SRTM, FIRMS) to the user-supplied AOI and time window.
 * Exports a unified object consumed by downstream modules.
 */

/**
 * Load and filter all datasets for a given AOI and date range.
 * @param {ee.Geometry} aoi   - User-defined area of interest
 * @param {string}      start - Start date, e.g. '2023-06-01'
 * @param {string}      end   - End date,   e.g. '2023-09-01'
 * @returns {Object} Dictionary of filtered ImageCollections / Images
 */
function loadDatasets(aoi, start, end) {

  // ── MODIS NDVI (250 m, 16-day composites) ─────────────────────────────
  // Scale factor: 0.0001  |  Valid range: -2000–10000
  var ndvi = ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterDate(start, end)
    .filterBounds(aoi)
    .select(['NDVI', 'SummaryQA']);   // SummaryQA retained for cloud masking

  // ── MODIS LST (1 km, daily) ────────────────────────────────────────────
  // Scale factor: 0.02  |  Units after scaling: Kelvin
  var lst = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterDate(start, end)
    .filterBounds(aoi)
    .select(['LST_Day_1km', 'QC_Day']); // QC_Day retained for cloud masking

  // ── CHIRPS Daily Precipitation (~5.5 km) ──────────────────────────────
  // Units: mm/day  |  Coverage: 50°S–50°N
  var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(start, end)
    .filterBounds(aoi)
    .select('precipitation');

  // ── ERA5-Land Wind Components (~11 km, daily aggregates) ──────────────
  // u/v in m/s; scalar wind speed = sqrt(u²+v²)
  var era5raw = ee.ImageCollection('ECMWF/ERA5_LAND/DAILY_AGGR')
    .filterDate(start, end)
    .filterBounds(aoi)
    .select(['u_component_of_wind_10m', 'v_component_of_wind_10m']);

  var windSpeed = era5raw.map(function(img) {
    var u = img.select('u_component_of_wind_10m');
    var v = img.select('v_component_of_wind_10m');
    return u.pow(2).add(v.pow(2)).sqrt()
      .rename('wind_speed')
      .copyProperties(img, ['system:time_start']);
  });

  // ── SRTM DEM (30 m, static) ───────────────────────────────────────────
  var srtm = ee.Image('USGS/SRTMGL1_003').clip(aoi);

  // ── FIRMS Active Fire (1 km, daily) ───────────────────────────────────
  // Current period – near-real-time detection display
  var firmsRecent = ee.ImageCollection('FIRMS')
    .filterDate(start, end)
    .filterBounds(aoi);

  // Historical 2000–present – used to compute Historical Fire Density (HFD)
  var firmsHistorical = ee.ImageCollection('FIRMS')
    .filterDate('2000-01-01', end)
    .filterBounds(aoi);

  return {
    ndvi:            ndvi,
    lst:             lst,
    chirps:          chirps,
    windSpeed:       windSpeed,
    srtm:            srtm,
    firmsRecent:     firmsRecent,
    firmsHistorical: firmsHistorical
  };
}

exports.loadDatasets = loadDatasets;
