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
Map.setOptions('HYBRID');
Map.setCenter(0, 20, 3);
Map.drawingTools().setShown(true);
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

  if (!(total > 0)) {
    return cloneWeights(DEFAULT_WEIGHTS);
  }

  var normalised = {};
  FACTOR_SPECS.forEach(function(spec) {
    normalised[spec.key] = cleaned[spec.key] / total;
  });

  return normalised;
}

// Global references to avoid duplicate inspector panels / stale click handlers
var inspectorPanel = null;
var inspectorSessionId = 0;

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
//  MODULE 10 — CHART
// ══════════════════════════════════════════════════════════════════════════════
function buildRiskChart(stats, targetPanel) {
  targetPanel.clear();

  stats.evaluate(function(s) {
    if (!s) {
      targetPanel.add(ui.Label('No statistics returned.', {
        fontSize: '11px',
        color: '#888'
      }));
      return;
    }

    // ── A. AOI risk statistics ───────────────────────────────────────────────
    targetPanel.add(ui.Label('AOI Risk Statistics', {
      fontSize: '12px',
      fontWeight: 'bold',
      margin: '4px 0'
    }));

    targetPanel.add(ui.Label(
      'High: ' + (s.high.area || 0).toFixed(2) + ' km² (' + (s.high.pct || 0).toFixed(1) + '%)',
      {fontSize: '11px', color: '#d7191c'}
    ));

    targetPanel.add(ui.Label(
      'Medium: ' + (s.medium.area || 0).toFixed(2) + ' km² (' + (s.medium.pct || 0).toFixed(1) + '%)',
      {fontSize: '11px', color: '#f4a02b'}
    ));

    targetPanel.add(ui.Label(
      'Low: ' + (s.low.area || 0).toFixed(2) + ' km² (' + (s.low.pct || 0).toFixed(1) + '%)',
      {fontSize: '11px', color: '#1a9641'}
    ));

    targetPanel.add(ui.Label(
      'Total AOI area (classified): ' + (s.total || 0).toFixed(2) + ' km²',
      {fontSize: '11px', color: '#666'}
    ));

    targetPanel.add(ui.Label(
      'AOI area (geometry): ' + (s.aoi_area_km2 || 0).toFixed(2) + ' km²',
      {fontSize: '11px', color: '#666'}
    ));

    targetPanel.add(ui.Label(
      'Adaptive scale used: ' + (s.adaptive_scale_m || 0).toFixed(0) + ' m',
      {fontSize: '11px', color: '#666', margin: '0 0 6px 0'}
    ));

    // ── B. WRI summary ───────────────────────────────────────────────────────
    targetPanel.add(ui.Label('WRI Summary', {
      fontSize: '12px',
      fontWeight: 'bold',
      margin: '6px 0 2px 0'
    }));

    targetPanel.add(ui.Label(
      'Mean WRI: ' + ((s.wri_summary && s.wri_summary.mean) || 0).toFixed(3),
      {fontSize: '11px'}
    ));

    targetPanel.add(ui.Label(
      'Max WRI: ' + ((s.wri_summary && s.wri_summary.max) || 0).toFixed(3),
      {fontSize: '11px', margin: '0 0 6px 0'}
    ));

    // ── C. WRI histogram as text ────────────────────────────────────────────
    targetPanel.add(ui.Label('WRI Distribution (Histogram)', {
      fontSize: '12px',
      fontWeight: 'bold',
      margin: '6px 0 2px 0'
    }));

    var hist = s.histogram || [];
    if (hist.length > 0) {
      var step = 0.1;

      hist.forEach(function(bin) {
        if (!bin || bin.length < 2) return;

        var lower = Number(bin[0]);
        var upper = lower + step;
        var count = Number(bin[1] || 0);

        targetPanel.add(ui.Label(
          lower.toFixed(1) + '–' + upper.toFixed(1) + ': ' + count,
          {fontSize: '10px', color: '#666'}
        ));
      });
    } else {
      targetPanel.add(ui.Label('No histogram available.', {
        fontSize: '11px',
        color: '#888'
      }));
    }

    // ── D. Factor contribution ranking ──────────────────────────────────────
    targetPanel.add(ui.Label('Factor Contribution Ranking', {
      fontSize: '12px',
      fontWeight: 'bold',
      margin: '6px 0 2px 0'
    }));

    var cs = s.contribution_scores || {};
    var contribList = [
      {name: 'Vegetation Dryness', value: cs.VDI || 0},
      {name: 'Land Surface Temp', value: cs.LST || 0},
      {name: 'Precip. Deficit', value: cs.PA || 0},
      {name: 'Wind Speed', value: cs.WS || 0},
      {name: 'Terrain Slope', value: cs.SLOPE || 0},
      {name: 'Fire History', value: cs.HFD || 0}
    ];

    contribList.sort(function(a, b) {
      return b.value - a.value;
    });

    contribList.forEach(function(item, idx) {
      targetPanel.add(ui.Label(
        (idx + 1) + '. ' + item.name + ' — ' + item.value.toFixed(3),
        {fontSize: '11px'}
      ));
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 11 — CLICK INSPECTOR
// ══════════════════════════════════════════════════════════════════════════════
function initInspector(wri, normBands, classified) {
  inspectorSessionId += 1;
  var sessionId = inspectorSessionId;

  if (inspectorPanel) {
    Map.remove(inspectorPanel);
    inspectorPanel = null;
  }

  var panel = ui.Panel({
    style: {width: '220px', padding: '8px', position: 'bottom-right'}
  });

  var coordLbl = ui.Label('Click a point on the map.', {
    fontSize: '11px',
    color: '#888'
  });
  var wriLbl = ui.Label('', {
    fontSize: '12px',
    fontWeight: 'bold'
  });
  var clsLbl = ui.Label('', {
    fontSize: '11px'
  });
  var fPanel = ui.Panel();

  panel.add(ui.Label('📍 Click Inspector', {
    fontSize: '13px',
    fontWeight: 'bold'
  }));
  panel.add(coordLbl);
  panel.add(wriLbl);
  panel.add(clsLbl);
  panel.add(ui.Label('──────────────────', {
    color: '#ddd',
    margin: '4px 0'
  }));
  panel.add(fPanel);

  inspectorPanel = panel;
  Map.add(panel);

  var allBands = wri.addBands(normBands)
    .addBands(classified.rename('risk_class'))
    .unmask(-1);

  Map.onClick(function(c) {
    // Ignore stale click handlers from previous runs
    if (sessionId !== inspectorSessionId) return;

    var pt = ee.Geometry.Point([c.lon, c.lat]);
    coordLbl.setValue('Lat: ' + c.lat.toFixed(4) + '  Lon: ' + c.lon.toFixed(4));
    wriLbl.setValue('Sampling…');
    clsLbl.setValue('');
    fPanel.clear();

    allBands.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: pt,
      scale: 1000,
      bestEffort: true
    }).evaluate(function(v) {
      if (sessionId !== inspectorSessionId) return;

      if (!v || v['WRI'] === null || v['WRI'] < 0) {
        wriLbl.setValue('No data at this location.');
        clsLbl.setValue('');
        return;
      }

      var cls = v['risk_class'] || 1;
      var col = cls === 3 ? '#d7191c' : cls === 2 ? '#f4a02b' : '#1a9641';
      var txt = cls === 3 ? '🔴 High Risk' : cls === 2 ? '🟠 Medium Risk' : '🟢 Low Risk';

      wriLbl.setValue('WRI: ' + (v['WRI'] || 0).toFixed(3));
      wriLbl.style().set('color', col);
      clsLbl.setValue(txt);
      clsLbl.style().set('color', col);

      [['VDI', 'Vegetation Dryness'],
       ['LST', 'Land Surf. Temp'],
       ['PA', 'Precip. Deficit'],
       ['WS', 'Wind Speed'],
       ['SLOPE', 'Terrain Slope'],
       ['HFD', 'Fire History']].forEach(function(f) {
        var val = v[f[0]] || 0;
        var col2 = val >= 0.67 ? '#d7191c' : val >= 0.33 ? '#fdae61' : '#1a9641';

        fPanel.add(ui.Panel([
          ui.Label(f[1], {fontSize: '10px', width: '120px'}),
          ui.Label(Array(Math.round(val * 10) + 1).join('█'),
            {color: col2, fontSize: '10px'}),
          ui.Label(val.toFixed(2), {fontSize: '10px', color: '#666'})
        ], ui.Panel.Layout.flow('horizontal'), {margin: '1px 0'}));
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 09 — CONTROL PANEL
// ══════════════════════════════════════════════════════════════════════════════
function buildControlPanel(onRun) {
  var S = {
    title:   {fontSize:'18px', fontWeight:'bold', color:'#d7191c', margin:'4px 0 2px'},
    sub:     {fontSize:'11px', color:'#888', margin:'0 0 6px'},
    section: {fontSize:'12px', fontWeight:'bold', color:'#333', margin:'8px 0 3px'},
    label:   {fontSize:'11px', color:'#555', margin:'2px 0 1px'},
    div:     {color:'#ddd', margin:'4px 0'},
    input:   {width:'220px'},
    btn:     {width:'228px', margin:'6px 0'}
  };

  var panel = ui.Panel({style:{width:'250px', padding:'10px'}});
  panel.add(ui.Label('🔥 EMBER', S.title));
  panel.add(ui.Label('Earth Monitoring of Burn Exposure Risk', S.sub));
  panel.add(ui.Label('──────────────────────────', S.div));

  panel.add(ui.Label('Analysis Period', S.section));
  panel.add(ui.Label('Start date (YYYY-MM-DD)', S.label));
  var startBox = ui.Textbox({value:'2023-06-01', style:S.input});
  panel.add(startBox);
  panel.add(ui.Label('End date (YYYY-MM-DD)', S.label));
  var endBox = ui.Textbox({value:'2023-09-01', style:S.input});
  panel.add(endBox);

  panel.add(ui.Label('──────────────────────────', S.div));
  panel.add(ui.Label('Area of Interest', S.section));
  panel.add(ui.Label('Use the ✏ toolbar on the map to draw a rectangle or polygon.',
                     {fontSize:'11px',color:'#666'}));
  panel.add(ui.Button({
    label:'✕  Clear geometry',
    style:S.btn,
    onClick: function() {
      Map.drawingTools().layers().reset();
    }
  }));

  panel.add(ui.Label('──────────────────────────', S.div));
  panel.add(ui.Label('Factor Weights (0 – 1)', S.section));

  var PRESETS = {
    'Equal weights (default)': {
      w1:0.17, w2:0.17, w3:0.17, w4:0.17, w5:0.17, w6:0.17,
      desc:'Balanced — no prior knowledge of the region'
    },
    'Drought & heat stress': {
      w1:0.30, w2:0.25, w3:0.25, w4:0.10, w5:0.05, w6:0.05,
      desc:'Arid/semi-arid regions during dry season'
    },
    'Wind-driven fire': {
      w1:0.20, w2:0.10, w3:0.15, w4:0.35, w5:0.15, w6:0.05,
      desc:'Open grasslands, coastal shrublands'
    },
    'Mountain & terrain': {
      w1:0.20, w2:0.10, w3:0.15, w4:0.20, w5:0.30, w6:0.05,
      desc:'Steep forested slopes, canyon terrain'
    },
    'High historical risk': {
      w1:0.15, w2:0.15, w3:0.15, w4:0.15, w5:0.10, w6:0.30,
      desc:'Regions with recurrent fire history'
    },
    'Mediterranean summer': {
      w1:0.25, w2:0.20, w3:0.30, w4:0.10, w5:0.10, w6:0.05,
      desc:'Southern Europe, California, Chile (Jun–Sep)'
    },
    'Custom (manual)': {
      w1:0.17, w2:0.17, w3:0.17, w4:0.17, w5:0.17, w6:0.17,
      desc:'Adjust the sliders below yourself'
    }
  };

  var presetKeys = Object.keys(PRESETS);
  var descLabel = ui.Label(PRESETS[presetKeys[0]].desc, {
    fontSize:'10px',
    color:'#888',
    margin:'1px 0 5px'
  });

  var presetSelect = ui.Select({
    items: presetKeys,
    value: presetKeys[0],
    style: {width:'228px'},
    onChange: function(chosen) {
      var p = PRESETS[chosen];
      descLabel.setValue(p.desc);
      ['w1','w2','w3','w4','w5','w6'].forEach(function(k) {
        sliders[k].slider.setValue(p[k], true);
      });
    }
  });

  panel.add(ui.Label('Scenario preset', S.label));
  panel.add(presetSelect);
  panel.add(descLabel);
  panel.add(ui.Label('Fine-tune below if needed:', {
    fontSize:'10px',
    color:'#aaa',
    margin:'3px 0 1px'
  }));

  var factorDefs = [
    {label:'Vegetation Dryness (VDI)', key:'w1'},
    {label:'Land Surface Temp  (LST)', key:'w2'},
    {label:'Precip. Deficit    (PA)',  key:'w3'},
    {label:'Wind Speed         (WS)',  key:'w4'},
    {label:'Terrain Slope   (SLOPE)',  key:'w5'},
    {label:'Fire History      (HFD)',  key:'w6'}
  ];

  var sliders = {};
  factorDefs.forEach(function(f) {
    var vl = ui.Label('0.17', {fontSize:'10px', color:'#888'});
    panel.add(ui.Panel(
      [ui.Label(f.label, {fontSize:'10px', width:'165px'}), vl],
      ui.Panel.Layout.flow('horizontal'),
      {margin:'1px 0'}
    ));

    var sl = ui.Slider({
      min:0,
      max:1,
      value:1/6,
      step:0.05,
      style:{width:'220px'},
      onChange: function(v) {
        vl.setValue(v.toFixed(2));
        presetSelect.setValue('Custom (manual)', false);
        descLabel.setValue(PRESETS['Custom (manual)'].desc);
      }
    });

    sliders[f.key] = {slider: sl, label: vl};
    panel.add(sl);
  });

  panel.add(ui.Label('──────────────────────────', S.div));
  var statusLabel = ui.Label('', {fontSize:'11px', color:'#666'});

  panel.add(ui.Button({
    label:'▶  Run Analysis',
    style:S.btn,
    onClick: function() {
      var layers = Map.drawingTools().layers();
      if (layers.length() === 0) {
        statusLabel.setValue('⚠ Please draw an AOI first.');
        return;
      }

      statusLabel.setValue('⏳ Running — please wait…');
      onRun(
        layers.get(0).toGeometry(),
        startBox.getValue(),
        endBox.getValue(),
        {
          w1: sliders.w1.slider.getValue(),
          w2: sliders.w2.slider.getValue(),
          w3: sliders.w3.slider.getValue(),
          w4: sliders.w4.slider.getValue(),
          w5: sliders.w5.slider.getValue(),
          w6: sliders.w6.slider.getValue()
        },
        statusLabel
      );
    }
  }));

  panel.add(statusLabel);

  panel.add(ui.Label('──────────────────────────', S.div));
  panel.add(ui.Label('Risk Breakdown', S.section));
  var resultsPanel = ui.Panel({style:{margin:'0'}});
  panel.add(resultsPanel);

  panel.add(ui.Label('──────────────────────────', S.div));
  panel.add(ui.Label(
    'Data: MODIS · ERA5-Land · CHIRPS · SRTM · FIRMS\nCASA0025 · UCL CASA',
    {fontSize:'9px', color:'#aaa'}
  ));

  return {panel:panel, resultsPanel:resultsPanel};
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN — wire everything together
// ══════════════════════════════════════════════════════════════════════════════
function runAnalysis(aoi, start, end, weights, statusLabel) {
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
    if (name === 'WRI — Continuous' || name === 'Risk Classification (High / Medium / Low)') {
      Map.layers().remove(layerList.get(i));
    }
  }

  Map.addLayer(
    wri,
    {
      min:0,
      max:1,
      palette:['#1a9641','#a6d96a','#ffffbf','#fdae61','#d7191c']
    },
    'WRI — Continuous',
    false
  );

  Map.addLayer(
    classified,
    {min:1, max:3, palette:['#1a9641','#fdae61','#d7191c']},
    'Risk Classification (High / Medium / Low)'
  );

  Map.centerObject(aoi, 8);

  showWRILegend();

  var stats = computeZonalStats(wri, classified, normStack, weights, aoi);
  print('Zonal Stats:', stats);
  buildRiskChart(stats, resultsPanel);

  initInspector(wri, normStack, classified);

  statusLabel.setValue('✅ Done. Click any point on the map to inspect values.');
}

// ══════════════════════════════════════════════════════════════════════════════
//  GLOBAL FIRE LAYER — displayed on startup, no AOI required
// ══════════════════════════════════════════════════════════════════════════════
function loadGlobalFireLayer(daysBack) {
  daysBack = daysBack || 30;

  var end30 = '2024-09-01';
  var start30 = '2024-08-02';
  var start7 = '2024-08-25';

  var firms30 = ee.ImageCollection('FIRMS')
    .filterDate(start30, end30)
    .map(function(img) {
      return img.select('T21').gt(0).rename('fire')
        .copyProperties(img, ['system:time_start']);
    });

  var fireCount30 = firms30.sum().selfMask();
  var fireVis30 = fireCount30.visualize({
    min: 1,
    max: 15,
    palette: ['#ff9900', '#ff5500', '#cc2200']
  });

  var firms7 = ee.ImageCollection('FIRMS')
    .filterDate(start7, end30)
    .map(function(img) {
      return img.select('T21').gt(0).selfMask().rename('fire')
        .copyProperties(img, ['system:time_start']);
    });

  var fireCount7 = firms7.sum().selfMask();
  var fireVis7 = fireCount7.visualize({
    min: 1,
    max: 5,
    palette: ['#ffcc00', '#ff4400', '#cc0000']
  });

  Map.addLayer(fireVis30, {}, 'Active Fires — 30 days', true, 0.65);
  Map.addLayer(fireVis7, {}, 'Active Fires — 7 days (latest)', true, 0.9);
}

// ══════════════════════════════════════════════════════════════════════════════
//  LEGENDS — created once, never duplicated
// ══════════════════════════════════════════════════════════════════════════════
var fireLegend = ui.Panel({
  style: {
    position:'bottom-left',
    padding:'8px',
    backgroundColor:'rgba(255,255,255,0.88)',
    width:'190px'
  }
});

fireLegend.add(ui.Label('Global Fire Activity', {
  fontSize:'12px',
  fontWeight:'bold',
  margin:'0 0 5px'
}));

[
  {color:'#cc0000', text:'Very high activity (7d)'},
  {color:'#ff4400', text:'High activity (7d)'},
  {color:'#ffcc00', text:'Recent fire (7d)'},
  {color:'#ff9900', text:'Historical fire (30d)'}
].forEach(function(r) {
  fireLegend.add(ui.Panel([
    ui.Label('■', {color:r.color, fontSize:'14px', margin:'0 5px 0 0'}),
    ui.Label(r.text, {fontSize:'11px', color:'#444'})
  ], ui.Panel.Layout.flow('horizontal'), {margin:'1px 0'}));
});

fireLegend.add(ui.Label('Source: NASA FIRMS / MODIS', {
  fontSize:'9px',
  color:'#aaa',
  margin:'5px 0 0'
}));

Map.add(fireLegend);

var wriLegend = ui.Panel({
  style: {
    position:'bottom-center',
    padding:'8px',
    backgroundColor:'rgba(255,255,255,0.92)',
    width:'260px'
  }
});

Map.add(wriLegend);

function showWRILegend() {
  wriLegend.clear();

  wriLegend.add(ui.Label('Wildfire Risk Index (WRI)', {
    fontSize:'12px',
    fontWeight:'bold',
    margin:'0 0 5px'
  }));

  var colorBar = ui.Panel([
    ui.Label('', {backgroundColor:'#fee8c8', padding:'8px', margin:'0'}),
    ui.Label('', {backgroundColor:'#fdbb84', padding:'8px', margin:'0'}),
    ui.Label('', {backgroundColor:'#fc8d59', padding:'8px', margin:'0'}),
    ui.Label('', {backgroundColor:'#ef6548', padding:'8px', margin:'0'}),
    ui.Label('', {backgroundColor:'#b30000', padding:'8px', margin:'0'})
  ], ui.Panel.Layout.flow('horizontal'), {
    stretch:'horizontal',
    margin:'2px 0 3px 0'
  });

  wriLegend.add(colorBar);

  wriLegend.add(ui.Panel([
    ui.Label('0.0 — Low', {fontSize:'10px', color:'#1a9641'}),
    ui.Label('0.33', {fontSize:'10px', color:'#aaa', textAlign:'center', stretch:'horizontal'}),
    ui.Label('0.67', {fontSize:'10px', color:'#aaa', textAlign:'center', stretch:'horizontal'}),
    ui.Label('1.0 — High', {fontSize:'10px', color:'#d7191c', textAlign:'right'})
  ], ui.Panel.Layout.flow('horizontal'), {stretch:'horizontal'}));

  wriLegend.add(ui.Panel([
    ui.Label('──────────────────────────────', {
      color:'#ddd',
      margin:'4px 0 3px',
      stretch:'horizontal'
    })
  ], ui.Panel.Layout.flow('horizontal')));

  [
    {color:'#1a9641', label:'Low  (WRI < 0.33)'},
    {color:'#fdae61', label:'Medium  (0.33 – 0.67)'},
    {color:'#d7191c', label:'High  (WRI ≥ 0.67)'}
  ].forEach(function(r) {
    wriLegend.add(ui.Panel([
      ui.Label('■', {color:r.color, fontSize:'14px', margin:'0 5px 0 0'}),
      ui.Label(r.label, {fontSize:'11px', color:'#333'})
    ], ui.Panel.Layout.flow('horizontal'), {margin:'1px 0'}));
  });
}

// ── Build UI and launch ──────────────────────────────────────────────────────
var uiResult = buildControlPanel(runAnalysis);
var resultsPanel = uiResult.resultsPanel;
ui.root.insert(0, uiResult.panel);

// Display global fire layer immediately on load
loadGlobalFireLayer(30);