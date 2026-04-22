/**
 * main.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Entry point — assembles all modules and wires up the GEE application.
 *
 * Execution order:
 *   1. Build UI (control panel, map layers, inspector)
 *   2. On "Run Analysis" click:
 *       a. Load & preprocess datasets  (01–04)
 *       b. Compute WRI & classification (05–06)
 *       c. Compute zonal statistics    (07)
 *       d. Render layers & charts      (08–10)
 *       e. Activate click inspector    (11)
 */

// ══════════════════════════════════════════════════════════════════════════════
//  EMBER — Earth Monitoring of Burn Exposure Risk
//  CASA0025 Group Project · UCL Centre for Advanced Spatial Analysis
//
//  HOW TO RUN:
//    1. Paste this entire file into the GEE Code Editor
//    2. Click Run
//    3. Draw a rectangle / polygon on the map (✏ toolbar)
//    4. Adjust dates and weights in the left panel if needed
//    5. Click ▶ Run Analysis
// ══════════════════════════════════════════════════════════════════════════════

// ── 0. Map initialisation ─────────────────────────────────────────────────────
// Custom dark basemap tuned to match the EMBER outer-shell palette.
// Palette cues: --bg #080b10, --border rgba(255,80,30,.18), --text-dim #6a7385.
var EMBER_DARK_STYLE = [
  {elementType: 'geometry',           stylers: [{color: '#0f141c'}]},
  {elementType: 'labels.text.fill',   stylers: [{color: '#6a7385'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#080b10'}]},
  {elementType: 'labels.icon',        stylers: [{visibility: 'off'}]},

  {featureType: 'administrative',                elementType: 'geometry',        stylers: [{color: '#2a3442'}]},
  {featureType: 'administrative.country',        elementType: 'geometry.stroke', stylers: [{color: '#3a4656'}]},
  {featureType: 'administrative.province',       elementType: 'geometry.stroke', stylers: [{color: '#30384a'}]},
  {featureType: 'administrative.land_parcel',                                    stylers: [{visibility: 'off'}]},

  {featureType: 'landscape.natural',   elementType: 'geometry', stylers: [{color: '#141923'}]},
  {featureType: 'landscape.man_made',  elementType: 'geometry', stylers: [{color: '#10151e'}]},

  {featureType: 'poi',                 stylers: [{visibility: 'off'}]},
  {featureType: 'poi.park',   elementType: 'geometry', stylers: [{color: '#161d28'}]},

  {featureType: 'road',            elementType: 'geometry',        stylers: [{color: '#1d2633'}]},
  {featureType: 'road',            elementType: 'labels.text.fill',stylers: [{color: '#5a6578'}]},
  {featureType: 'road.highway',    elementType: 'geometry',        stylers: [{color: '#2a3442'}]},
  {featureType: 'road.highway',    elementType: 'labels.text.fill',stylers: [{color: '#7a8598'}]},
  {featureType: 'road.arterial',   elementType: 'geometry',        stylers: [{color: '#222a36'}]},
  {featureType: 'road.local',      elementType: 'geometry',        stylers: [{color: '#1a222e'}]},

  {featureType: 'transit',         stylers: [{visibility: 'off'}]},

  {featureType: 'water', elementType: 'geometry',        stylers: [{color: '#060910'}]},
  {featureType: 'water', elementType: 'labels.text.fill',stylers: [{color: '#4a5565'}]}
];

var EMBER_MAP_STYLES = {
  DARK: EMBER_DARK_STYLE
};

// Register the custom style AND set it as the active basemap in one call.
// The user can still switch to HYBRID / SATELLITE / TERRAIN / ROADMAP via the
// outer-shell dropdown — handled by the SET_BASEMAP postMessage listener below.
Map.setOptions('DARK', EMBER_MAP_STYLES);
Map.setCenter(0, 20, 3);

// Hide ALL the GEE-provided map chrome — the outer shell owns every control,
// including zoom. Dark-themed +/- buttons in index.html drive Map.setZoom()
// via postMessage, and scroll-wheel zoom is enabled by the map's greedy
// gesture handling (no Ctrl required).
Map.setControlVisibility({ all: false });

Map.drawingTools().setShown(false);               // hide the native white toolbar
Map.drawingTools().setLinked(false);              // suppress the "geometry" chip
Map.drawingTools().setDrawModes(['rectangle', 'polygon']);
// Shared constants / helpers for Modules 05–06
var FACTOR_SPECS = [
  { key: 'w1', band: 'VDI',   label: 'Vegetation Dryness', shortLabel: 'VDI' },
  { key: 'w2', band: 'LST',   label: 'Land Surface Temp',  shortLabel: 'LST' },
  { key: 'w3', band: 'PA',    label: 'Precip. Deficit',    shortLabel: 'PA' },
  { key: 'w4', band: 'WS',    label: 'Wind Speed',         shortLabel: 'WS' },
  { key: 'w5', band: 'SLOPE', label: 'Terrain Slope',      shortLabel: 'SLOPE' },
  { key: 'w6', band: 'HFD',   label: 'Fire History',       shortLabel: 'HFD' }
];

var DEFAULT_WEIGHTS = {
  w1: 1 / FACTOR_SPECS.length,
  w2: 1 / FACTOR_SPECS.length,
  w3: 1 / FACTOR_SPECS.length,
  w4: 1 / FACTOR_SPECS.length,
  w5: 1 / FACTOR_SPECS.length,
  w6: 1 / FACTOR_SPECS.length
};

var WRI_THRESHOLDS = {
  lowMedium: 0.33,
  mediumHigh: 0.67
};

var RISK_CLASS_INFO = [
  { value: 1, key: 'low',    label: 'Low',    color: '#1a9641', rangeLabel: 'WRI < 0.33' },
  { value: 2, key: 'medium', label: 'Medium', color: '#fdae61', rangeLabel: '0.33 – 0.67' },
  { value: 3, key: 'high',   label: 'High',   color: '#d7191c', rangeLabel: 'WRI ≥ 0.67' }
];

function cloneWeights(weights) {
  return {
    w1: weights.w1,
    w2: weights.w2,
    w3: weights.w3,
    w4: weights.w4,
    w5: weights.w5,
    w6: weights.w6
  };
}

function toSafeWeight(value) {
  var numeric = Number(value);
  if (!isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

function normaliseWeights(rawWeights) {
  var cleaned = {};
  var total = 0;

  FACTOR_SPECS.forEach(function(spec) {
    var safeWeight = toSafeWeight(rawWeights && rawWeights[spec.key]);
    cleaned[spec.key] = safeWeight;
    total += safeWeight;
  });

  // If the caller passed all-zero / invalid weights, fall back to defaults
  // instead of dividing by zero below.
  if (total <= 0) {
    return cloneWeights(DEFAULT_WEIGHTS);
  }

  var normalised = {};
  FACTOR_SPECS.forEach(function(spec) {
    normalised[spec.key] = cleaned[spec.key] / total;
  });

  return normalised;
}

// Session id gates stale inspector click handlers after each new run
var inspectorSessionId = 0;
var clickMarkerLayer = null;

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 01 — DATA IMPORT
// ══════════════════════════════════════════════════════════════════════════════
function loadDatasets(aoi, start, end) {
  var ndvi = ee.ImageCollection('MODIS/061/MOD13Q1')
    .filterDate(start, end).filterBounds(aoi)
    .select(['NDVI', 'SummaryQA']);

  // MOD11A2: 8-day composite (was MOD11A1 daily — 8× fewer images to process)
  var lst = ee.ImageCollection('MODIS/061/MOD11A2')
    .filterDate(start, end).filterBounds(aoi)
    .select(['LST_Day_1km', 'QC_Day']);

  // CHIRPS pentad (5-day): was CHIRPS daily — 5× fewer images
  var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/PENTAD')
    .filterDate(start, end).filterBounds(aoi)
    .select('precipitation');

  // ERA5 monthly: was daily — 30× fewer images for wind
  var era5raw = ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY_AGGR')
    .filterDate(start, end).filterBounds(aoi)
    .select(['u_component_of_wind_10m', 'v_component_of_wind_10m']);

  var windSpeed = era5raw.map(function(img) {
    var u = img.select('u_component_of_wind_10m');
    var v = img.select('v_component_of_wind_10m');
    return u.pow(2).add(v.pow(2)).sqrt().rename('wind_speed')
      .copyProperties(img, ['system:time_start']);
  });

  var srtm = ee.Image('USGS/SRTMGL1_003').clip(aoi);

  // FIRMS from recent years: enough for HFD and lighter to process
  var firmsHistorical = ee.ImageCollection('FIRMS')
    .filterDate('2018-01-01', end).filterBounds(aoi);

  return {
    ndvi: ndvi,
    lst: lst,
    chirps: chirps,
    windSpeed: windSpeed,
    srtm: srtm,
    firmsHistorical: firmsHistorical
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 02 — CLOUD MASKING
// ══════════════════════════════════════════════════════════════════════════════
function applyModisCloudMask(image) {
  var bands = image.bandNames();
  var masked = ee.Algorithms.If(
    bands.contains('SummaryQA'),
    image.select('NDVI').updateMask(image.select('SummaryQA').lte(1)),
    image.select('LST_Day_1km').updateMask(
      image.select('QC_Day').bitwiseAnd(3).lte(1)
    )
  );
  return ee.Image(masked).copyProperties(image, ['system:time_start']);
}

// Pre-compute static masks ONCE — avoid reloading on every analysis run
var _waterMask = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
  .select('occurrence').lt(30).unmask(1);

var _iceMask = ee.ImageCollection('MODIS/061/MCD12Q1')
  .filterDate('2020-01-01', '2021-01-01').first()
  .select('LC_Type1').neq(15);

function maskWaterAndIce(image) {
  return image.updateMask(_waterMask).updateMask(_iceMask);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 03 — ANOMALY CALCULATION
// ══════════════════════════════════════════════════════════════════════════════
function computeLSTAnomaly(lstCol, start, end, aoi) {
  var sm = ee.Date(start).get('month');
  var em = ee.Date(end).get('month');

  var toK = function(img) {
    return img.select('LST_Day_1km').multiply(0.02).rename('LST_K')
      .copyProperties(img, ['system:time_start']);
  };

  var current = lstCol.map(toK).mean();

  var baseline = ee.ImageCollection('MODIS/061/MOD11A2')
    .filterBounds(aoi)
    .filterDate('2018-01-01', '2022-12-31')
    .filter(ee.Filter.calendarRange(sm, em, 'month'))
    .map(toK)
    .mean();

  return current.subtract(baseline).rename('LST_anomaly');
}

function computePrecipAnomaly(chirpsCol, start, end, aoi) {
  var sm = ee.Date(start).get('month');
  var em = ee.Date(end).get('month');

  var current = chirpsCol.select('precipitation').mean();

  var baseline = ee.ImageCollection('UCSB-CHG/CHIRPS/PENTAD')
    .filterBounds(aoi)
    .filterDate('2018-01-01', '2022-12-31')
    .filter(ee.Filter.calendarRange(sm, em, 'month'))
    .select('precipitation')
    .mean();

  return baseline.subtract(current).rename('precip_deficit');
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 04 — NORMALISATION
// ══════════════════════════════════════════════════════════════════════════════
function normalise(image, aoi) {
  var band = ee.String(image.bandNames().get(0));
  var pcts = image.reduceRegion({
    reducer: ee.Reducer.percentile([1, 99]),
    geometry: aoi,
    scale: 2000,
    maxPixels: 1e9,
    bestEffort: true
  });

  var p1 = ee.Number(pcts.get(band.cat('_p1')));
  var p99 = ee.Number(pcts.get(band.cat('_p99')));

  return image.clamp(p1, p99).subtract(p1)
    .divide(p99.subtract(p1).max(1e-10))
    .clamp(0, 1)
    .rename(band);
}

/**
 * Batch-normalise a 6-band image in ONE reduceRegion call.
 * Input bands: VDI, LST, PA, WS, SLOPE, HFD
 */
function normaliseBatch(stack6, aoi) {
  var pcts = stack6.reduceRegion({
    reducer: ee.Reducer.percentile([1, 99]),
    geometry: aoi,
    scale: 2000,
    maxPixels: 1e9,
    bestEffort: true
  });

  var bands = ['VDI', 'LST', 'PA', 'WS', 'SLOPE', 'HFD'];

  var normedList = bands.map(function(b) {
    var p1 = ee.Number(pcts.get(b + '_p1'));
    var p99 = ee.Number(pcts.get(b + '_p99'));
    return stack6.select(b)
      .clamp(p1, p99)
      .subtract(p1)
      .divide(p99.subtract(p1).max(1e-10))
      .clamp(0, 1)
      .rename(b);
  });

  return ee.Image(normedList[0])
    .addBands(normedList[1])
    .addBands(normedList[2])
    .addBands(normedList[3])
    .addBands(normedList[4])
    .addBands(normedList[5]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 05 — RISK INDEX
// ══════════════════════════════════════════════════════════════════════════════
function computeHFD(firms, aoi) {
  var fireCount = firms.map(function(img) {
    return img.select('T21').gt(0).rename('fire');
  }).sum().clip(aoi);

  return fireCount
    .focalMean({radius: 3, kernelType: 'circle', units: 'pixels'})
    .rename('HFD');
}

function computeWRI(normBands, rawWeights) {
  var weights = normaliseWeights(rawWeights);
  var numerator = ee.Image(0);
  var denominator = ee.Image(0);
  var availableBands = normBands.bandNames();

  FACTOR_SPECS.forEach(function(spec) {
    var factorImage = ee.Image(ee.Algorithms.If(
      availableBands.contains(spec.band),
      normBands.select(spec.band),
      ee.Image.constant(0).rename(spec.band).updateMask(ee.Image.constant(0))
    ));
    var safeWeight = weights[spec.key];
    var validMask = factorImage.mask().gt(0);

    numerator = numerator.add(factorImage.unmask(0).multiply(safeWeight));
    denominator = denominator.add(
      ee.Image.constant(safeWeight).updateMask(validMask).unmask(0)
    );
  });

  var safeDenominator = denominator.where(denominator.lte(0), 1e-10);

  return numerator
    .divide(safeDenominator)
    .updateMask(denominator.gt(0))
    .clamp(0, 1)
    .rename('WRI');
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 06 — CLASSIFICATION
// ══════════════════════════════════════════════════════════════════════════════
function classifyRisk(wri) {
  return ee.Image(1)
    .where(wri.gte(WRI_THRESHOLDS.lowMedium), 2)
    .where(wri.gte(WRI_THRESHOLDS.mediumHigh), 3)
    .updateMask(wri.mask())
    .rename('risk_class')
    .toInt8();
}

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
    thresholds: ee.Dictionary(WRI_THRESHOLDS),
    low: addPercentages(low),
    medium: addPercentages(medium),
    high: addPercentages(high),
    totalAreaKm2: totalAreaKm2,
    totalPixels: totalPixels
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 07 — ZONAL STATISTICS
// ══════════════════════════════════════════════════════════════════════════════
function getAOIAreaKm2(aoi) {
  return ee.Number(aoi.area(1)).divide(1e6);
}

function getAdaptiveScale(aoi) {
  var areaKm2 = getAOIAreaKm2(aoi);
  return ee.Number(
    ee.Algorithms.If(
      areaKm2.lte(50000), 1000,
      ee.Algorithms.If(
        areaKm2.lte(200000), 2000,
        5000
      )
    )
  );
}

function computeZonalStats(wri, classified, normBands, weights, aoi) {
  var adaptiveScale = getAdaptiveScale(aoi);
  var aoiAreaKm2 = getAOIAreaKm2(aoi);

  // A. Area by risk class (km²) + percentage
  var pixelArea = ee.Image.pixelArea().divide(1e6).rename('area_km2');
  var combined = pixelArea.addBands(classified.rename('risk_class'));

  var areaStats = combined.reduceRegion({
    reducer: ee.Reducer.sum().group({
      groupField: 1,
      groupName: 'cls'
    }),
    geometry: aoi,
    scale: adaptiveScale,
    maxPixels: 1e10,
    bestEffort: true,
    tileScale: 4
  });

  var groups = ee.List(ee.Algorithms.If(
    areaStats.get('groups'),
    areaStats.get('groups'),
    ee.List([])
  ));

  var getArea = function(classVal) {
    var result = ee.List(groups).iterate(function(item, acc) {
      item = ee.Dictionary(item);
      acc = ee.Number(acc);
      return ee.Number(ee.Algorithms.If(
        ee.Number(item.get('cls')).eq(classVal),
        item.get('sum'),
        acc
      ));
    }, 0);
    return ee.Number(result);
  };

  var highArea = getArea(3);
  var medArea = getArea(2);
  var lowArea = getArea(1);
  var totalArea = highArea.add(medArea).add(lowArea).max(1e-10);

  // B. WRI mean + max
  var wriStats = wri.reduceRegion({
    reducer: ee.Reducer.mean().combine({
      reducer2: ee.Reducer.max(),
      sharedInputs: true
    }),
    geometry: aoi,
    scale: adaptiveScale,
    maxPixels: 1e10,
    bestEffort: true,
    tileScale: 4
  });

  // C. WRI histogram
  // fixedHistogram returns [lowerEdge, count]
  var histStats = wri.reduceRegion({
    reducer: ee.Reducer.fixedHistogram(0, 1, 10),
    geometry: aoi,
    scale: adaptiveScale,
    maxPixels: 1e10,
    bestEffort: true,
    tileScale: 4
  });

  // D. Per-factor contribution ranking
  var totalW = weights.w1 + weights.w2 + weights.w3 +
               weights.w4 + weights.w5 + weights.w6;

  var nw = {
    w1: weights.w1 / totalW,
    w2: weights.w2 / totalW,
    w3: weights.w3 / totalW,
    w4: weights.w4 / totalW,
    w5: weights.w5 / totalW,
    w6: weights.w6 / totalW
  };

  var factorMeans = normBands.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: adaptiveScale,
    maxPixels: 1e10,
    bestEffort: true,
    tileScale: 4
  });

  var contributionScores = ee.Dictionary({
    VDI: ee.Number(factorMeans.get('VDI', 0)).multiply(nw.w1),
    LST: ee.Number(factorMeans.get('LST', 0)).multiply(nw.w2),
    PA: ee.Number(factorMeans.get('PA', 0)).multiply(nw.w3),
    WS: ee.Number(factorMeans.get('WS', 0)).multiply(nw.w4),
    SLOPE: ee.Number(factorMeans.get('SLOPE', 0)).multiply(nw.w5),
    HFD: ee.Number(factorMeans.get('HFD', 0)).multiply(nw.w6)
  });

  return ee.Dictionary({
    high: ee.Dictionary({
      area: highArea,
      pct: highArea.divide(totalArea).multiply(100)
    }),
    medium: ee.Dictionary({
      area: medArea,
      pct: medArea.divide(totalArea).multiply(100)
    }),
    low: ee.Dictionary({
      area: lowArea,
      pct: lowArea.divide(totalArea).multiply(100)
    }),
    total: totalArea,

    aoi_area_km2: aoiAreaKm2,
    adaptive_scale_m: adaptiveScale,

    wri_summary: ee.Dictionary({
      mean: ee.Number(wriStats.get('WRI_mean', 0)),
      max: ee.Number(wriStats.get('WRI_max', 0))
    }),

    histogram: ee.List(histStats.get('WRI', ee.List([]))),
    contribution_scores: contributionScores
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 08 — MAP LAYERS (headless — no on-map controls)
//  Basemap / layer toggle / opacity are driven by postMessage from index.html.
// ══════════════════════════════════════════════════════════════════════════════
function addAnalysisLayers(wri, classified, aoi) {
  Map.centerObject(aoi, 8);

  var wriLayer = ui.Map.Layer(
    wri,
    {
      min: 0,
      max: 1,
      palette: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c']
    },
    'WRI — Continuous',
    true,
    1
  );

  var classLayer = ui.Map.Layer(
    classified,
    {
      min: 1,
      max: 3,
      palette: ['#2ecc71', '#f39c12', '#c0392b']
    },
    'Risk Classification (High / Medium / Low)',
    true,
    0.35
  );

  Map.layers().add(wriLayer);
  Map.layers().add(classLayer);

  // Hide the AOI drawing polygon now that results are visible.
  // Do this on the GEE side directly (no postMessage round-trip) so it
  // takes effect as soon as the analysis layers appear on the map.
  var drawLayers = Map.drawingTools().layers();
  for (var a = 0; a < drawLayers.length(); a++) {
    drawLayers.get(a).setShown(false);
  }
  // Tell the outer dashboard to uncheck the AOI Polygon toggle.
  postToParent({ type: 'AOI_HIDDEN' });

  return {
    wriLayer: wriLayer,
    classLayer: classLayer
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 10 — STATS PAYLOAD
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Evaluate zonal stats server-side and push a structured payload to index.html.
 * All chart / table rendering happens in the outer dashboard.
 */
function postStatsToParent(stats) {
  stats.evaluate(function(s, err) {
    if (err || !s) {
      postStatus('error', 'Stats computation failed: ' + (err || 'empty'));
      return;
    }

    var wriMean = (s.wri_summary && s.wri_summary.mean) || 0;
    var wriMax  = (s.wri_summary && s.wri_summary.max)  || 0;
    var highKm  = (s.high   && s.high.area)   || 0;
    var medKm   = (s.medium && s.medium.area) || 0;
    var lowKm   = (s.low    && s.low.area)    || 0;
    var highPct = (s.high   && s.high.pct)    || 0;
    var medPct  = (s.medium && s.medium.pct)  || 0;
    var lowPct  = (s.low    && s.low.pct)     || 0;

    var cs = s.contribution_scores || {};
    var contribution = [
      {key: 'VDI',   name: 'Vegetation Dryness', value: Number(cs.VDI   || 0)},
      {key: 'LST',   name: 'Land Surface Temp',  value: Number(cs.LST   || 0)},
      {key: 'PA',    name: 'Precip. Deficit',    value: Number(cs.PA    || 0)},
      {key: 'WS',    name: 'Wind Speed',         value: Number(cs.WS    || 0)},
      {key: 'SLOPE', name: 'Terrain Slope',      value: Number(cs.SLOPE || 0)},
      {key: 'HFD',   name: 'Fire History',       value: Number(cs.HFD   || 0)}
    ].sort(function(a, b) { return b.value - a.value; });

    var histogram = (s.histogram || []).map(function(bin) {
      if (!bin || bin.length < 2) return {lower: 0, count: 0};
      return {lower: Number(bin[0]), count: Number(bin[1] || 0)};
    });

    postToParent({
      type: 'EMBER_STATS',
      // Headline metrics
      wri:       wriMean,
      wriMax:    wriMax,
      fireArea:  Math.round(highKm),     // High-risk area (km²)
      totalKm2:  Number(s.total || 0),
      aoiKm2:    Number(s.aoi_area_km2 || 0),
      scaleM:    Number(s.adaptive_scale_m || 0),
      // Class breakdown
      high:      Math.round(highPct),
      medium:    Math.round(medPct),
      low:       Math.round(lowPct),
      highKm:    highKm,
      medKm:     medKm,
      lowKm:     lowKm,
      // Rich payloads for the outer panels
      histogram: histogram,
      contribution: contribution
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 11 — INSPECTOR
// ══════════════════════════════════════════════════════════════════════════════

function classLabelForValue(v) {
  if (v === 1) return 'Low';
  if (v === 2) return 'Medium';
  if (v === 3) return 'High';
  return 'Unknown';
}

/**
 * Register a Map.onClick handler that, for each click, samples the WRI /
 * classification / factor bands at that point and ships the result to the
 * outer dashboard via postMessage. All rendering happens in index.html.
 */
function initInspector(wri, normBands, classified, hfdRaw) {
  inspectorSessionId += 1;
  var sessionId = inspectorSessionId;

  var allBands = normBands
    .addBands(wri)
    .addBands(classified.rename('risk_class'))
    .addBands(hfdRaw.rename('HFD_raw'))
    .unmask(-1);

  Map.onClick(function(c) {
    if (sessionId !== inspectorSessionId) return;

    // Refresh the click-marker layer so users can see what they picked
    if (clickMarkerLayer) {
      Map.layers().remove(clickMarkerLayer);
      clickMarkerLayer = null;
    }
    var clickPoint = ee.Geometry.Point([c.lon, c.lat]);
    var clickPointImage = ee.Image().paint(clickPoint, 1, 3);
    clickMarkerLayer = ui.Map.Layer(
      clickPointImage,
      {palette: ['#000000']},
      'Inspector Click Point',
      true,
      1
    );
    Map.layers().add(clickMarkerLayer);

    // Announce "click started" so the outer panel can show a loading state
    postToParent({
      type: 'PIXEL_INSPECT_START',
      lat: c.lat,
      lon: c.lon
    });

    allBands.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: clickPoint,
      scale: 1000,
      bestEffort: true
    }).evaluate(function(v, err) {
      if (sessionId !== inspectorSessionId) return;

      if (err || !v || v.WRI === null || v.WRI === undefined || v.WRI < 0) {
        postToParent({
          type: 'PIXEL_INSPECT',
          lat: c.lat,
          lon: c.lon,
          hasData: false,
          error: err ? String(err) : null
        });
        return;
      }

      var cls = Number(v.risk_class || 1);
      postToParent({
        type: 'PIXEL_INSPECT',
        hasData: true,
        lat: c.lat,
        lon: c.lon,
        wri: Number(v.WRI),
        riskClass: cls,
        riskLabel: classLabelForValue(cls),
        hfdNorm: v.HFD === null || v.HFD === undefined ? null : Number(v.HFD),
        hfdRaw: v.HFD_raw === null || v.HFD_raw === undefined ? 0 : Number(v.HFD_raw),
        factors: {
          VDI:   Number(v.VDI   || 0),
          LST:   Number(v.LST   || 0),
          PA:    Number(v.PA    || 0),
          WS:    Number(v.WS    || 0),
          SLOPE: Number(v.SLOPE || 0),
          HFD:   Number(v.HFD   || 0)
        }
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN — driven by postMessage commands from index.html
// ══════════════════════════════════════════════════════════════════════════════
function runAnalysis(aoi, start, end, weights) {
  postStatus('loading', 'Running wildfire risk analysis…');
  var data = loadDatasets(aoi, start, end);

  var ndviComp = data.ndvi.map(applyModisCloudMask).median();
  var lstComp = data.lst.map(applyModisCloudMask).median();

  var lstAnom = computeLSTAnomaly(data.lst, start, end, aoi);
  var precipDef = computePrecipAnomaly(data.chirps, start, end, aoi);

  var ndviScaled = ndviComp.multiply(0.0001);
  var vdiRaw = ee.Image(1).subtract(ndviScaled.add(1).divide(2)).rename('VDI');
  var lstRaw = lstAnom.rename('LST');
  var paRaw = precipDef.rename('PA');
  var wsRaw = data.windSpeed.mean().rename('WS');
  var slopeRaw = ee.Terrain.slope(data.srtm).rename('SLOPE');
  var hfdRaw = computeHFD(data.firmsHistorical, aoi).rename('HFD');

  var rawStack = vdiRaw
    .addBands(lstRaw)
    .addBands(paRaw)
    .addBands(wsRaw)
    .addBands(slopeRaw)
    .addBands(hfdRaw);

  var normStack = normaliseBatch(rawStack, aoi);
  normStack = maskWaterAndIce(normStack);

  var wri = computeWRI(normStack, weights);
  var classified = classifyRisk(wri);

  var layerList = Map.layers();
  for (var i = layerList.length() - 1; i >= 0; i--) {
    var name = layerList.get(i).getName();
    if (
      name === 'WRI — Continuous' ||
      name === 'Risk Classification (High / Medium / Low)' ||
      name === 'Inspector Click Point'
    ) {
      Map.layers().remove(layerList.get(i));
    }
  }

  addAnalysisLayers(wri, classified, aoi);

  var stats = computeZonalStats(wri, classified, normStack, weights, aoi);
  print('Zonal Stats:', stats);
  postStatsToParent(stats);

  // 12-month FIRMS time-series for the outer chart (fire and forget)
  computeFireTimeseries(aoi, end).evaluate(function(series, err) {
    if (err || !series) return;
    postToParent({
      type: 'TIMESERIES',
      points: series.map(function(pt) {
        return {month: pt.month, count: Number(pt.count) || 0};
      })
    });
  });

  initInspector(wri, normStack, classified, hfdRaw);
  postStatus('done', 'Analysis complete. Click any point on the map to inspect.');
}

// ══════════════════════════════════════════════════════════════════════════════
//  GLOBAL FIRE LAYER — context layer shown on startup before AOI selection.
//  Kept lightweight: single 30-day composite at low opacity. Can be toggled
//  from the outer shell via TOGGLE_LAYER / SET_OPACITY if desired.
// ══════════════════════════════════════════════════════════════════════════════
function loadGlobalFireLayer() {
  var end30   = '2024-09-01';
  var start30 = '2024-08-02';

  var fireCount30 = ee.ImageCollection('FIRMS')
    .filterDate(start30, end30)
    .select('T21')
    .map(function(img) { return img.gt(0).rename('fire'); })
    .sum()
    .selfMask();

  var fireVis30 = fireCount30.visualize({
    min: 1, max: 15,
    palette: ['#ff9900', '#ff5500', '#cc2200']
  });

  Map.addLayer(fireVis30, {}, 'Active Fires — 30 days', true, 0.55);
}

// ══════════════════════════════════════════════════════════════════════════════
//  EMBEDDED MODE — bridge between outer HTML dashboard and GEE App iframe
//  All UI controls (sliders, presets, Run button, results) live in index.html.
//  This script only renders the map + layers and communicates via postMessage.
// ══════════════════════════════════════════════════════════════════════════════
function postToParent(msg) {
  try {
    if (typeof window !== 'undefined' &&
        window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
  } catch (err) { /* Code-Editor sandbox — safe no-op */ }
}

function postStatus(state, message) {
  postToParent({type: 'STATUS', state: state, message: message || ''});
}

var aoiNotifyPending = false;
function notifyAOIDrawn() {
  if (aoiNotifyPending) return;
  var layers = Map.drawingTools().layers();
  if (layers.length() === 0) {
    postToParent({type: 'AOI_CLEARED'});
    return;
  }
  aoiNotifyPending = true;
  var geom = layers.get(0).toGeometry();
  geom.area(1).divide(1e6).evaluate(function(km2, err) {
    aoiNotifyPending = false;
    if (err || km2 == null) return;
    geom.bounds().evaluate(function(bounds) {
      postToParent({
        type: 'AOI_DRAWN',
        areaKm2: Number(km2) || 0,
        bbox: (bounds && bounds.coordinates) ? bounds.coordinates : null
      });
    });
  });
}

// Hook AOI drawing events
Map.drawingTools().onDraw(notifyAOIDrawn);
Map.drawingTools().onEdit(notifyAOIDrawn);
Map.drawingTools().onErase(notifyAOIDrawn);

// ── 12-month FIRMS time-series (for outer bottom chart) ─────────────────────
function computeFireTimeseries(aoi, end) {
  var endDate = ee.Date(end);
  var startDate = endDate.advance(-12, 'month');

  var firms = ee.ImageCollection('FIRMS')
    .filterDate(startDate, endDate)
    .filterBounds(aoi)
    .map(function(img) {
      return img.select('T21').gt(0).rename('fire')
        .copyProperties(img, ['system:time_start']);
    });

  var monthIndices = ee.List.sequence(0, 11);
  return monthIndices.map(function(i) {
    var m = startDate.advance(ee.Number(i), 'month');
    var mEnd = m.advance(1, 'month');
    var summed = firms.filterDate(m, mEnd).sum().reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 2000,
      maxPixels: 1e9,
      bestEffort: true
    });
    return ee.Dictionary({
      month: m.format('YYYY-MM'),
      count: ee.Number(summed.get('fire', 0))
    });
  });
}

// ── Inbound commands from outer dashboard ───────────────────────────────────
var lastDrawnAOI = null;
try {
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', function(e) {
      var d = e && e.data;
      if (!d || !d.type) return;

      if (d.type === 'RUN') {
        var layers = Map.drawingTools().layers();
        if (layers.length() === 0) {
          postStatus('error', 'Please draw an AOI on the map first.');
          return;
        }
        var aoi = layers.get(0).toGeometry();
        lastDrawnAOI = aoi;
        runAnalysis(aoi, d.start, d.end, d.weights);
      } else if (d.type === 'CLEAR_AOI') {
        Map.drawingTools().layers().reset();
        postToParent({type: 'AOI_CLEARED'});
      } else if (d.type === 'DRAW_START') {
        // Replace any previous AOI and arm the drawing tool for a new shape.
        // setShape() alone puts the drawing tools into draw mode — ".draw()"
        // is not part of the public API and was causing the tool to fail
        // silently when the native toolbar is hidden.
        Map.drawingTools().layers().reset();
        var shape = (d.shape === 'polygon') ? 'polygon' : 'rectangle';
        Map.drawingTools().setShape(shape);
      } else if (d.type === 'DRAW_STOP') {
        Map.drawingTools().setShape(null);
      } else if (d.type === 'TOGGLE_LAYER') {
        // Special pseudo-layer: the drawn AOI polygon lives in the drawing
        // tools, not Map.layers(). Toggle every drawn geometry layer.
        if (d.layerName === '__AOI__') {
          var aoiLayers = Map.drawingTools().layers();
          for (var a = 0; a < aoiLayers.length(); a++) {
            aoiLayers.get(a).setShown(!!d.visible);
          }
          return;
        }
        var lyrs = Map.layers();
        for (var i = 0; i < lyrs.length(); i++) {
          if (lyrs.get(i).getName() === d.layerName) {
            lyrs.get(i).setShown(!!d.visible);
            break;
          }
        }
      } else if (d.type === 'SET_OPACITY') {
        var lyrs2 = Map.layers();
        for (var j = 0; j < lyrs2.length(); j++) {
          if (lyrs2.get(j).getName() === d.layerName) {
            lyrs2.get(j).setOpacity(Number(d.opacity) || 0);
            break;
          }
        }
      } else if (d.type === 'SET_BASEMAP') {
        var bm = d.basemap || 'DARK';
        // Always pass the styles dict so DARK remains registered even if the
        // user switched to a built-in basemap in the meantime.
        Map.setOptions(bm, EMBER_MAP_STYLES);
      } else if (d.type === 'ZOOM') {
        var zCur = Map.getZoom() || 3;
        var delta = Number(d.delta) || 0;
        Map.setZoom(Math.max(1, Math.min(20, zCur + delta)));
      }
    });
  }
} catch (err) { /* no-op in Code Editor */ }

// ── Startup ──────────────────────────────────────────────────────────────────
loadGlobalFireLayer();
postStatus('ready', 'EMBER ready. Draw an AOI on the map.');
