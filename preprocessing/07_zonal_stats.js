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