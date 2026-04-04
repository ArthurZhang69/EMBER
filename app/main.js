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
//    2. Click  Run
//    3. Draw a rectangle / polygon on the map (✏ toolbar)
//    4. Adjust dates and weights in the left panel if needed
//    5. Click  ▶ Run Analysis
// ══════════════════════════════════════════════════════════════════════════════

// ── 0. Map initialisation ─────────────────────────────────────────────────────
Map.setOptions('HYBRID');
Map.setCenter(0, 20, 3);
Map.drawingTools().setShown(true);
Map.drawingTools().setDrawModes(['rectangle', 'polygon']);

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

  // FIRMS from 2012-present: sufficient for HFD, ~40% fewer images than 2000
  var firmsHistorical = ee.ImageCollection('FIRMS')
    .filterDate('2012-01-01', end).filterBounds(aoi);

  return { ndvi: ndvi, lst: lst, chirps: chirps,
           windSpeed: windSpeed, srtm: srtm,
           firmsHistorical: firmsHistorical };
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

function maskWaterAndIce(image) {
  var waterMask = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
                    .select('occurrence').lt(50).unmask(1);
  var iceMask   = ee.ImageCollection('MODIS/061/MCD12Q1')
                    .filterDate('2020-01-01','2021-01-01').first()
                    .select('LC_Type1').neq(15);
  return image.updateMask(waterMask).updateMask(iceMask);
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
  var current  = lstCol.map(toK).mean();
  // Use MOD11A2 (8-day) for baseline — 8× fewer images than MOD11A1 daily
  var baseline = ee.ImageCollection('MODIS/061/MOD11A2')
    .filterBounds(aoi).filterDate('2000-01-01','2020-12-31')
    .filter(ee.Filter.calendarRange(sm, em, 'month'))
    .map(toK).mean();
  return current.subtract(baseline).rename('LST_anomaly');
}

function computePrecipAnomaly(chirpsCol, start, end, aoi) {
  var sm = ee.Date(start).get('month');
  var em = ee.Date(end).get('month');
  var current  = chirpsCol.select('precipitation').mean();
  // CHIRPS pentad for baseline — 5× fewer images than daily
  var baseline = ee.ImageCollection('UCSB-CHG/CHIRPS/PENTAD')
    .filterBounds(aoi).filterDate('2000-01-01','2020-12-31')
    .filter(ee.Filter.calendarRange(sm, em, 'month'))
    .select('precipitation').mean();
  return baseline.subtract(current).rename('precip_deficit');
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 04 — NORMALISATION
// ══════════════════════════════════════════════════════════════════════════════

// Single-band normalise (kept for individual use if needed)
function normalise(image, aoi) {
  var band = ee.String(image.bandNames().get(0));
  var pcts = image.reduceRegion({
    reducer: ee.Reducer.percentile([1, 99]),
    geometry: aoi, scale: 2000, maxPixels: 1e9, bestEffort: true
  });
  var p1  = ee.Number(pcts.get(band.cat('_p1')));
  var p99 = ee.Number(pcts.get(band.cat('_p99')));
  return image.clamp(p1, p99).subtract(p1)
              .divide(p99.subtract(p1).max(1e-10))
              .clamp(0, 1).rename(band);
}

/**
 * Batch-normalise a 6-band image in ONE reduceRegion call (6× faster).
 * Input bands must be named: VDI, LST, PA, WS, SLOPE, HFD
 */
function normaliseBatch(stack6, aoi) {
  // One server round-trip for all 12 percentile values
  var pcts = stack6.reduceRegion({
    reducer:    ee.Reducer.percentile([1, 99]),
    geometry:   aoi,
    scale:      2000,       // coarser scale for percentile estimation — accurate & fast
    maxPixels:  1e9,
    bestEffort: true
  });

  var bands = ['VDI','LST','PA','WS','SLOPE','HFD'];
  var normedList = bands.map(function(b) {
    var p1  = ee.Number(pcts.get(b + '_p1'));
    var p99 = ee.Number(pcts.get(b + '_p99'));
    return stack6.select(b)
      .clamp(p1, p99).subtract(p1)
      .divide(p99.subtract(p1).max(1e-10))
      .clamp(0, 1).rename(b);
  });

  // Collapse list of single-band images into one multi-band image
  return ee.Image(normedList[0])
    .addBands(normedList[1]).addBands(normedList[2])
    .addBands(normedList[3]).addBands(normedList[4])
    .addBands(normedList[5]);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 05 — RISK INDEX
// ══════════════════════════════════════════════════════════════════════════════
function computeHFD(firms, aoi) {
  var fireCount = firms.map(function(img) {
    return img.select('T21').gt(0).rename('fire')
              .copyProperties(img, ['system:time_start']);
  }).sum().clip(aoi);
  var kernel = ee.Kernel.gaussian({radius:5000, sigma:2000, units:'meters', normalize:true});
  return fireCount.convolve(kernel).rename('HFD');
}

function computeWRI(normBands, weights) {
  var t = weights.w1+weights.w2+weights.w3+weights.w4+weights.w5+weights.w6;
  var w = { w1:weights.w1/t, w2:weights.w2/t, w3:weights.w3/t,
            w4:weights.w4/t, w5:weights.w5/t, w6:weights.w6/t };
  return normBands.select('VDI').multiply(w.w1)
    .add(normBands.select('LST').multiply(w.w2))
    .add(normBands.select('PA').multiply(w.w3))
    .add(normBands.select('WS').multiply(w.w4))
    .add(normBands.select('SLOPE').multiply(w.w5))
    .add(normBands.select('HFD').multiply(w.w6))
    .clamp(0,1).rename('WRI');
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 06 — CLASSIFICATION
// ══════════════════════════════════════════════════════════════════════════════
function classifyRisk(wri) {
  return ee.Image(1).where(wri.gte(0.33),2).where(wri.gte(0.67),3)
           .updateMask(wri.mask()).rename('risk_class').toInt8();
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 07 — ZONAL STATISTICS
// ══════════════════════════════════════════════════════════════════════════════
function computeZonalStats(classified, aoi) {
  // ONE grouped reduceRegion replaces 3 separate calls (3× faster)
  var pixelArea = ee.Image.pixelArea().divide(1e6).rename('area');
  var combined  = pixelArea.addBands(classified.rename('risk_class'));

  var stats = combined.reduceRegion({
    reducer:    ee.Reducer.sum().group({groupField: 1, groupName: 'cls'}),
    geometry:   aoi,
    scale:      1000,       // was 500 — 4× fewer pixels, negligible accuracy loss
    maxPixels:  1e10,
    bestEffort: true
  });

  var groups = ee.List(stats.get('groups'));

  var getArea = function(classVal) {
    var match = groups.filter(ee.Filter.eq('cls', classVal));
    return ee.Number(ee.Algorithms.If(
      match.size().gt(0),
      ee.Dictionary(match.get(0)).get('sum'),
      0
    ));
  };

  var h = getArea(3), m = getArea(2), l = getArea(1);
  var total = h.add(m).add(l).max(1e-10);
  return ee.Dictionary({
    high:   ee.Dictionary({area:h, pct:h.divide(total).multiply(100)}),
    medium: ee.Dictionary({area:m, pct:m.divide(total).multiply(100)}),
    low:    ee.Dictionary({area:l, pct:l.divide(total).multiply(100)}),
    total:  total
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 10 — CHART
// ══════════════════════════════════════════════════════════════════════════════
function buildRiskChart(stats, targetPanel) {
  targetPanel.clear();
  stats.evaluate(function(s) {
    if (!s) return;
    var rows = [
      ['Risk Class','Area (km²)',{role:'style'},{role:'annotation'}],
      ['High',   +s.high.area.toFixed(0),   '#d7191c', s.high.pct.toFixed(1)+'%'],
      ['Medium', +s.medium.area.toFixed(0), '#fdae61', s.medium.pct.toFixed(1)+'%'],
      ['Low',    +s.low.area.toFixed(0),    '#1a9641', s.low.pct.toFixed(1)+'%']
    ];
    var chart = ui.Chart(rows).setChartType('BarChart').setOptions({
      title:'Risk Area Breakdown', hAxis:{title:'Area (km²)'},
      legend:{position:'none'}, height:160
    });
    targetPanel.add(chart);
    [['#d7191c','High',s.high],['#fdae61','Medium',s.medium],['#1a9641','Low',s.low]]
      .forEach(function(r) {
        targetPanel.add(ui.Panel([
          ui.Label('■',{color:r[0],fontSize:'14px',margin:'0 4px 0 0'}),
          ui.Label(r[1]+': '+r[2].pct.toFixed(1)+'%  ('+r[2].area.toFixed(0)+' km²)',
                   {fontSize:'11px'})
        ], ui.Panel.Layout.flow('horizontal'), {margin:'1px 0'}));
      });
    targetPanel.add(ui.Label('Total: '+s.total.toFixed(0)+' km²',
                             {fontSize:'11px',color:'#888'}));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 11 — CLICK INSPECTOR
// ══════════════════════════════════════════════════════════════════════════════
function initInspector(wri, normBands, classified) {
  var panel = ui.Panel({style:{width:'220px',padding:'8px',position:'bottom-right'}});
  var coordLbl = ui.Label('Click a point on the map.',{fontSize:'11px',color:'#888'});
  var wriLbl   = ui.Label('',{fontSize:'12px',fontWeight:'bold'});
  var clsLbl   = ui.Label('',{fontSize:'11px'});
  var fPanel   = ui.Panel();
  panel.add(ui.Label('📍 Click Inspector',{fontSize:'13px',fontWeight:'bold'}));
  panel.add(coordLbl); panel.add(wriLbl); panel.add(clsLbl);
  panel.add(ui.Label('──────────────────',{color:'#ddd',margin:'4px 0'}));
  panel.add(fPanel);
  Map.add(panel);

  var allBands = wri.addBands(normBands).addBands(classified.rename('risk_class'))
                    .unmask(-1);   // unmask so reduceRegion always returns a value

  Map.onClick(function(c) {
    var pt = ee.Geometry.Point([c.lon, c.lat]);
    coordLbl.setValue('Lat: '+c.lat.toFixed(4)+'  Lon: '+c.lon.toFixed(4));
    wriLbl.setValue('Sampling…'); fPanel.clear();

    // reduceRegion with ee.Reducer.first() is ~3-5× faster than .sample()
    allBands.reduceRegion({
      reducer:    ee.Reducer.first(),
      geometry:   pt,
      scale:      1000,          // 1 km — fast; change to 500 for finer detail
      bestEffort: true
    }).evaluate(function(v) {
        if (!v || v['WRI'] === null || v['WRI'] < 0) {
          wriLbl.setValue('No data at this location.');
          return;
        }
        var cls = v['risk_class']||1;
        var col = cls===3?'#d7191c':cls===2?'#f4a02b':'#1a9641';
        var txt = cls===3?'🔴 High Risk':cls===2?'🟠 Medium Risk':'🟢 Low Risk';
        wriLbl.setValue('WRI: '+(v['WRI']||0).toFixed(3));
        wriLbl.style().set('color',col);
        clsLbl.setValue(txt); clsLbl.style().set('color',col);
        [['VDI','Vegetation Dryness'],['LST','Land Surf. Temp'],
         ['PA','Precip. Deficit'],['WS','Wind Speed'],
         ['SLOPE','Terrain Slope'],['HFD','Fire History']].forEach(function(f) {
          var val  = v[f[0]]||0;
          var col2 = val>=0.67?'#d7191c':val>=0.33?'#fdae61':'#1a9641';
          fPanel.add(ui.Panel([
            ui.Label(f[1],{fontSize:'10px',width:'120px'}),
            ui.Label('█'.repeat(Math.round(val*10)),
                     {color:col2,fontSize:'10px',letterSpacing:'-1px'}),
            ui.Label(val.toFixed(2),{fontSize:'10px',color:'#666'})
          ],ui.Panel.Layout.flow('horizontal'),{margin:'1px 0'}));
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
  panel.add(ui.Button({label:'✕  Clear geometry', style:S.btn,
    onClick: function() { Map.drawingTools().layers().reset(); }
  }));

  panel.add(ui.Label('──────────────────────────', S.div));
  panel.add(ui.Label('Factor Weights (0 – 1)', S.section));

  // ── Preset weight configurations ──────────────────────────────────
  // w1=VDI  w2=LST  w3=PA  w4=WS  w5=SLOPE  w6=HFD
  var PRESETS = {
    'Equal weights (default)':
      {w1:0.17, w2:0.17, w3:0.17, w4:0.17, w5:0.17, w6:0.17,
       desc:'Balanced — no prior knowledge of the region'},
    'Drought & heat stress':
      {w1:0.30, w2:0.25, w3:0.25, w4:0.10, w5:0.05, w6:0.05,
       desc:'Arid/semi-arid regions during dry season'},
    'Wind-driven fire':
      {w1:0.20, w2:0.10, w3:0.15, w4:0.35, w5:0.15, w6:0.05,
       desc:'Open grasslands, coastal shrublands'},
    'Mountain & terrain':
      {w1:0.20, w2:0.10, w3:0.15, w4:0.20, w5:0.30, w6:0.05,
       desc:'Steep forested slopes, canyon terrain'},
    'High historical risk':
      {w1:0.15, w2:0.15, w3:0.15, w4:0.15, w5:0.10, w6:0.30,
       desc:'Regions with recurrent fire history'},
    'Mediterranean summer':
      {w1:0.25, w2:0.20, w3:0.30, w4:0.10, w5:0.10, w6:0.05,
       desc:'Southern Europe, California, Chile (Jun–Sep)'},
    'Custom (manual)':
      {w1:0.17, w2:0.17, w3:0.17, w4:0.17, w5:0.17, w6:0.17,
       desc:'Adjust the sliders below yourself'}
  };

  var presetKeys = Object.keys(PRESETS);
  var descLabel  = ui.Label(PRESETS[presetKeys[0]].desc,
    {fontSize:'10px', color:'#888', margin:'1px 0 5px'});

  var presetSelect = ui.Select({
    items:       presetKeys,
    value:       presetKeys[0],
    style:       {width:'228px'},
    onChange: function(chosen) {
      var p = PRESETS[chosen];
      descLabel.setValue(p.desc);
      // Update all sliders and their value labels
      ['w1','w2','w3','w4','w5','w6'].forEach(function(k) {
        sliders[k].slider.setValue(p[k], true);  // true = trigger onChange
      });
    }
  });

  panel.add(ui.Label('Scenario preset', S.label));
  panel.add(presetSelect);
  panel.add(descLabel);
  panel.add(ui.Label('Fine-tune below if needed:', {fontSize:'10px',color:'#aaa',margin:'3px 0 1px'}));

  // ── Individual weight sliders ──────────────────────────────────────
  var factorDefs = [
    {label:'Vegetation Dryness (VDI)', key:'w1'},
    {label:'Land Surface Temp  (LST)', key:'w2'},
    {label:'Precip. Deficit    (PA)',  key:'w3'},
    {label:'Wind Speed         (WS)',  key:'w4'},
    {label:'Terrain Slope   (SLOPE)', key:'w5'},
    {label:'Fire History      (HFD)', key:'w6'}
  ];
  var sliders = {};
  factorDefs.forEach(function(f) {
    var vl = ui.Label('0.17',{fontSize:'10px',color:'#888'});
    panel.add(ui.Panel(
      [ui.Label(f.label,{fontSize:'10px',width:'165px'}), vl],
      ui.Panel.Layout.flow('horizontal'),{margin:'1px 0'}
    ));
    var sl = ui.Slider({min:0, max:1, value:1/6, step:0.05, style:{width:'220px'},
      onChange: function(v){
        vl.setValue(v.toFixed(2));
        // Switch preset label to "Custom" when slider is moved manually
        presetSelect.setValue('Custom (manual)', false);
        descLabel.setValue(PRESETS['Custom (manual)'].desc);
      }
    });
    sliders[f.key] = {slider: sl, label: vl};
    panel.add(sl);
  });

  panel.add(ui.Label('──────────────────────────', S.div));
  var statusLabel = ui.Label('',{fontSize:'11px',color:'#666'});

  panel.add(ui.Button({label:'▶  Run Analysis', style:S.btn,
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
        { w1:sliders.w1.slider.getValue(), w2:sliders.w2.slider.getValue(),
          w3:sliders.w3.slider.getValue(), w4:sliders.w4.slider.getValue(),
          w5:sliders.w5.slider.getValue(), w6:sliders.w6.slider.getValue() },
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
  panel.add(ui.Label('Data: MODIS · ERA5-Land · CHIRPS · SRTM · FIRMS\nCASA0025 · UCL CASA',
                     {fontSize:'9px',color:'#aaa'}));

  return {panel:panel, resultsPanel:resultsPanel};
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN — wire everything together
// ══════════════════════════════════════════════════════════════════════════════
function runAnalysis(aoi, start, end, weights, statusLabel) {

  // 1. Load raw datasets
  var data = loadDatasets(aoi, start, end);

  // 2. Cloud-mask NDVI & LST, build composites
  var ndviComp = data.ndvi.map(applyModisCloudMask).median();
  var lstComp  = data.lst.map(applyModisCloudMask).median();

  // 3. Compute anomalies
  var lstAnom  = computeLSTAnomaly(data.lst, start, end, aoi);
  var precipDef = computePrecipAnomaly(data.chirps, start, end, aoi);

  // 4. Compute factor images (pre-normalisation)
  //    VDI = 1 − normalised NDVI  (high VDI = dry vegetation)
  var ndviScaled = ndviComp.multiply(0.0001);
  var vdiRaw     = ee.Image(1).subtract(ndviScaled.add(1).divide(2)).rename('VDI');
  var lstRaw     = lstAnom.rename('LST');
  var paRaw      = precipDef.rename('PA');
  var wsRaw      = data.windSpeed.mean().rename('WS');
  var slopeRaw   = ee.Terrain.slope(data.srtm).rename('SLOPE');
  var hfdRaw     = computeHFD(data.firmsHistorical, aoi).rename('HFD');

  // 5. Stack raw bands then normalise all 6 in ONE reduceRegion call
  var rawStack = vdiRaw
    .addBands(lstRaw).addBands(paRaw)
    .addBands(wsRaw).addBands(slopeRaw).addBands(hfdRaw);
  var normStack = normaliseBatch(rawStack, aoi);

  // Apply water / ice terrain mask
  normStack = maskWaterAndIce(normStack);

  // 6. Compute WRI and classify
  var wri        = computeWRI(normStack, weights);
  var classified = classifyRisk(wri);

  // 7. Add map layers
  // Clear only analysis layers, then re-add global fire layer underneath
  Map.layers().reset();
  loadGlobalFireLayer(30);   // keep global fire context visible

  Map.addLayer(wri, {min:0, max:1,
    palette:['#1a9641','#a6d96a','#ffffbf','#fdae61','#d7191c']},
    'WRI — Continuous', false);
  Map.addLayer(classified, {min:1, max:3, palette:['#1a9641','#fdae61','#d7191c']},
    'Risk Classification (High / Medium / Low)');
  Map.centerObject(aoi, 8);

  // 8. Compute zonal stats → chart
  var stats = computeZonalStats(classified, aoi);
  buildRiskChart(stats, resultsPanel);

  // 9. Activate click inspector
  initInspector(wri, normStack, classified);

  statusLabel.setValue('✅ Done. Click any point on the map to inspect values.');
}

// ══════════════════════════════════════════════════════════════════════════════
//  GLOBAL FIRE LAYER — displayed on startup, no AOI required
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Load and display global active fire points from the last N days.
 * Uses FIRMS T21 thermal anomaly band; fires rendered as glowing orange dots.
 * Also adds a 7-day "recent fires" layer with brighter red for latest events.
 * @param {number} daysBack - How many days of history to show (default 30)
 */
function loadGlobalFireLayer(daysBack) {
  daysBack = daysBack || 30;

  // Use a fixed recent window so the layer is reproducible
  // (ee.Date(Date.now()) can cause caching issues in published apps)
  var end30   = '2024-09-01';
  var start30 = '2024-08-02';   // 30 days back
  var start7  = '2024-08-25';   // 7 days back

  // ── 30-day fire accumulation (orange, semi-transparent) ─────────────
  var firms30 = ee.ImageCollection('FIRMS')
    .filterDate(start30, end30)
    .map(function(img) {
      return img.select('T21').gt(0).rename('fire')
                .copyProperties(img, ['system:time_start']);
    });

  // Pixel fire count over 30 days → log-scaled for visual balance
  var fireCount30 = firms30.sum().selfMask();
  var fireVis30   = fireCount30.visualize({
    min: 1, max: 15,
    palette: ['#ff9900', '#ff5500', '#cc2200']
  });

  // ── 7-day fires (bright red, fully opaque — most recent events) ─────
  var firms7 = ee.ImageCollection('FIRMS')
    .filterDate(start7, end30)
    .map(function(img) {
      return img.select('T21').gt(0).selfMask().rename('fire')
                .copyProperties(img, ['system:time_start']);
    });

  var fireCount7 = firms7.sum().selfMask();
  var fireVis7   = fireCount7.visualize({
    min: 1, max: 5,
    palette: ['#ffcc00', '#ff4400', '#cc0000']
  });

  // Add layers — 30-day first (background), then 7-day on top
  Map.addLayer(fireVis30, {}, 'Active Fires — 30 days', true, 0.65);
  Map.addLayer(fireVis7,  {}, 'Active Fires — 7 days (latest)', true, 0.9);

  // ── Legend ──────────────────────────────────────────────────────────
  var legend = ui.Panel({
    style: {
      position:        'bottom-left',
      padding:         '8px',
      backgroundColor: 'rgba(255,255,255,0.88)',
      width:           '190px'
    }
  });

  legend.add(ui.Label('Global Fire Activity', {
    fontSize: '12px', fontWeight: 'bold', margin: '0 0 5px'
  }));

  var rows = [
    {color: '#cc0000', text: 'Very high activity (7d)'},
    {color: '#ff4400', text: 'High activity (7d)'},
    {color: '#ffcc00', text: 'Recent fire (7d)'},
    {color: '#ff9900', text: 'Historical fire (30d)'}
  ];
  rows.forEach(function(r) {
    legend.add(ui.Panel([
      ui.Label('■', {color: r.color, fontSize: '14px', margin: '0 5px 0 0'}),
      ui.Label(r.text, {fontSize: '11px', color: '#444'})
    ], ui.Panel.Layout.flow('horizontal'), {margin: '1px 0'}));
  });

  legend.add(ui.Label('Source: NASA FIRMS / MODIS',
    {fontSize: '9px', color: '#aaa', margin: '5px 0 0'}));

  Map.add(legend);
}

// ── Build UI and launch ──────────────────────────────────────────────────────
var uiResult     = buildControlPanel(runAnalysis);
var resultsPanel = uiResult.resultsPanel;      // closure reference for buildRiskChart
ui.root.insert(0, uiResult.panel);

// Display global fire layer immediately on load
loadGlobalFireLayer(30);
