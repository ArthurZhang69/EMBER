/**
 * 01_data_import.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 * Module: Preprocessing I — Data Import & Temporal Filtering
 * 
 * 
 * 
 * 
 * 
 */

function loadDatasets(aoi, start, end) {

  // ── MODIS NDVI (250m, 16天合成) ───────────────────────────────────────────
  var ndvi = ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterDate(start, end)
    .filterBounds(aoi)
    .select(['NDVI', 'SummaryQA']);

  // ── MODIS LST (1km, 逐日) ─────────────────────────────────────────────────
  var lst = ee.ImageCollection('MODIS/061/MOD11A1')
    .filterDate(start, end)
    .filterBounds(aoi)
    .select(['LST_Day_1km', 'QC_Day']);

  // ── CHIRPS 降水 (daily) ───────────────────────────────────────────────────
  var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(start, end)
    .filterBounds(aoi)
    .select('precipitation');

  // ── ERA5-Land 风速（计算标量风速）────────────────────────────────────────
  // 注意：ERA5-Land 的风速数据是 u 和 v 分量，需要计算得到标量风速
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

  // ── SRTM 地形 (30m, 静态) ─────────────────────────────────────────────────
  var srtm    = ee.Image('USGS/SRTMGL1_003').clip(aoi);
  var terrain = ee.Terrain.products(srtm);
  var slope   = terrain.select('slope');

  // ── FIRMS 火点（双时段）──────────────────────────────────────────────────
  // 当前时段用于显示，历史时段用于计算历史火密度(HFD)
  var firmsRecent = ee.ImageCollection('FIRMS')
    .filterDate(start, end)
    .filterBounds(aoi);

  var firmsHistorical = ee.ImageCollection('FIRMS')
    .filterDate('2000-01-01', end)
    .filterBounds(aoi);

  // ── JRC 全球地表水（供 02 模块掩膜使用）──────────────────────────────────
  var jrcWater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
    .select(['occurrence', 'seasonality'])
    .clip(aoi);

  return {
    ndvi:            ndvi,
    lst:             lst,
    chirps:          chirps,
    windSpeed:       windSpeed,
    srtm:            srtm,
    slope:           slope,
    firmsRecent:     firmsRecent,
    firmsHistorical: firmsHistorical,
    jrcWater:        jrcWater
  };
}

exports.loadDatasets = loadDatasets;