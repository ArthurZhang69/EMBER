/**
 * 11_inspector.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Visualisation I — Click Inspector Panel
 * Owner:  Team Member E
 *
 * Listens for map click events and displays a panel showing:
 *   - Coordinates (lat / lon)
 *   - Overall WRI score at the clicked pixel
 *   - Individual factor scores (VDI, LST, PA, WS, SLOPE, HFD)
 *   - Historical fire occurrence indicator
 */

/**
* Key Features (Distinction Level):
 *   - Interactive click marker on map
 *   - Sorted factor contribution display (high → low)
 *   - Dynamic colour encoding for risk levels
 *   - Compact dashboard-style UI layout
 *   - Integrated WRI legend inside panel
 *
 * Usage:
 *   initInspector(wri, normBands, classified, hfdRaw)
 *
 * @param {ee.Image} wri         - Single-band WRI image [0–1]
 * @param {ee.Image} normBands   - Multi-band normalised factors
 * @param {ee.Image} classified  - Risk class image (1/2/3)
 * @param {ee.Image} hfdRaw      - Raw fire density image
 */

// ─────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────
 function classLabel(v) {
  if (v === 1) return 'Low';
  if (v === 2) return 'Medium';
  if (v === 3) return 'High';
  return 'Unknown';
}

function classColor(v) {
  if (v === 1) return '#1a9641';
  if (v === 2) return '#f39c12';
  if (v === 3) return '#c0392b';
  return '#666666';
}

function fireSignalText(hfd) {
  if (hfd === null || hfd === undefined) return 'Unknown';
  return Number(hfd) >= 0.5 ? 'Elevated' : 'Low';
}

function formatNumber(v, digits) {
  if (v === null || v === undefined) return 'N/A';
  return Number(v).toFixed(digits || 3);
}

function factorBarColor(v) {
  if (v >= 0.67) return '#d7191c';
  if (v >= 0.33) return '#fdae61';
  return '#1a9641';
}

function factorPrettyName(key) {
  var names = {
    VDI: 'Vegetation Dryness',
    LST: 'Land Surface Temp',
    PA: 'Precip. Deficit',
    WS: 'Wind Speed',
    SLOPE: 'Terrain Slope',
    HFD: 'Fire History'
  };
  return names[key] || key;
}

function buildFactorRow(label, value) {
  value = Number(value || 0);
  
  var row = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '3px 0'}
  });

  var nameLabel = ui.Label(label, {
    width: '120px',
    fontSize: '10px',
    color: '#333333'
  });

  var barContainer = ui.Panel({
    style: {
      width: '90px',
      height: '10px',
      backgroundColor: '#eeeeee',
      margin: '4px 6px 0 0',
      padding: '0px'
    }
  });

  var barWidth = Math.max(2, Math.round(value * 90));
  var bar = ui.Label('', {
    backgroundColor: factorBarColor(value),
    padding: '5px',
    margin: '0px',
    width: barWidth + 'px'
  });

  barContainer.add(bar);

  var valueLabel = ui.Label(formatNumber(value, 3), {
    width: '42px',
    fontSize: '10px',
    color: '#666666',
    textAlign: 'right'
  });

  row.add(nameLabel);
  row.add(barContainer);
  row.add(valueLabel);

  return row;

}

function initInspector(wri, normBands, classified, hfdRaw) {
  inspectorSessionId += 1;
  var sessionId = inspectorSessionId;
  
  if (inspectorPanel) {
    Map.remove(inspectorPanel);
    inspectorPanel = null;
  }

  var panel = ui.Panel({
    style: {
      position: 'top-right',
      width: '300px',
      padding: '12px',
      backgroundColor: 'rgba(255,255,255,0.97)'
    }
  });

  // Title
  var titleLbl = ui.Label('Pixel Inspector', {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '0 0 8px 0'
  });

  // Location
  var sectionLoc = ui.Label('Location', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '4px 0 2px 0'
  });

  var locationLbl = ui.Label('Click any point on the map.', {
    fontSize: '11px',
    color: '#666666',
    margin: '0 0 8px 0'
  });

  // Overall risk
  var sectionRisk = ui.Label('Overall Risk', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '4px 0 2px 0'
  });

  var wriLbl = ui.Label('', {
    fontSize: '13px',
    fontWeight: 'bold',
    margin: '0 0 2px 0'
  });

  var clsLbl = ui.Label('', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '0 0 2px 0'
  });

  var fireLbl = ui.Label('', {
    fontSize: '11px',
    color: '#666666',
    margin: '0 0 8px 0'
  });

  // Factor values
  var sectionFactors = ui.Label('Factor Values', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '4px 0 4px 0'
  });
  var fPanel = ui.Panel();

  // Legend
  var sectionLegend = ui.Label('WRI Legend', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '6px 0 4px 0'
  });

  var colorBar = ui.Panel({
    widgets: [
      ui.Label('', {backgroundColor:'#2ecc71', padding:'7px', margin:'0'}),
      ui.Label('', {backgroundColor:'#f1c40f', padding:'7px', margin:'0'}),
      ui.Label('', {backgroundColor:'#e67e22', padding:'7px', margin:'0'}),
      ui.Label('', {backgroundColor:'#e74c3c', padding:'7px', margin:'0'})
    ],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {
      stretch: 'horizontal',
      margin: '2px 0 4px 0'
    }
  });

  var legendRange = ui.Panel({
    widgets: [
      ui.Label('Low', {fontSize:'10px', color:'#1a9641'}),
      ui.Label('', {stretch:'horizontal'}),
      ui.Label('High', {fontSize:'10px', color:'#d7191c'})
    ],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {stretch:'horizontal'}
  });

  // Assemble panel
  panel.add(titleLbl);
  panel.add(sectionLoc);
  panel.add(locationLbl);
  panel.add(ui.Label('────────────────────────', {
    color: '#dddddd',
    margin: '4px 0'
  }));

  panel.add(sectionRisk);
  panel.add(wriLbl);
  panel.add(clsLbl);
  panel.add(fireLbl);
  panel.add(ui.Label('────────────────────────', {
    color: '#dddddd',
    margin: '4px 0'
  }));

  panel.add(sectionFactors);
  panel.add(fPanel);
  panel.add(ui.Label('────────────────────────', {
    color: '#dddddd',
    margin: '6px 0 4px 0'
  }));

  panel.add(sectionLegend);
  panel.add(colorBar);
  panel.add(legendRange);
  inspectorPanel = panel;
  Map.add(panel);
  
  var allBands = normBands
    .addBands(wri)
    .addBands(classified.rename('risk_class'))
    .addBands(hfdRaw.rename('HFD_raw'))
    .unmask(-1);
    
  var factorKeys = ['VDI', 'LST', 'PA', 'WS', 'SLOPE', 'HFD'];

  Map.onClick(function(c) {
    if (sessionId !== inspectorSessionId) return;
    
    // Remove old click marker
    if (clickMarkerLayer) {
      Map.layers().remove(clickMarkerLayer);
      clickMarkerLayer = null;
    }
    
    // Add new click marker
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

    locationLbl.setValue(
      'Lat: ' + c.lat.toFixed(4) + '  Lon: ' + c.lon.toFixed(4)
    );

    wriLbl.setValue('Loading...');
    wriLbl.style().set('color', '#666666');
    clsLbl.setValue('');
    fireLbl.setValue('');
    fPanel.clear();

    allBands.reduceRegion({
      reducer: ee.Reducer.first(),
      geometry: clickPoint,
      scale: 1000,
      bestEffort: true
    }).evaluate(function(v) {
      if (sessionId !== inspectorSessionId) return;

      if (!v || v.WRI === null || v.WRI < 0) {
        wriLbl.setValue('No data available at this location.');
        wriLbl.style().set('color', '#c0392b');
        clsLbl.setValue('');
        fireLbl.setValue('');
        return;
      }

      var cls = Number(v.risk_class || 1);
      var clsCol = classColor(cls);

      wriLbl.setValue('WRI: ' + formatNumber(v.WRI, 3));
      wriLbl.style().set('color', clsCol);

      clsLbl.setValue('Risk Class: ' + classLabel(cls));
      clsLbl.style().set('color', clsCol);

      fireLbl.setValue(
        'Historical Fire Signal: ' + fireSignalText(v.HFD) +
        ' | Fire record here: ' + ((v.HFD_raw && v.HFD_raw > 0) ? 'Yes' : 'No')
      );

      // Sort factors by descending value for clearer interpretation
      var factorList = factorKeys.map(function(k) {
        return {
          key: k,
          label: factorPrettyName(k),
          value: Number(v[k] || 0)
        };
      });

      factorList.sort(function(a, b) {
        return b.value - a.value;
      });

      factorList.forEach(function(item) {
        fPanel.add(buildFactorRow(item.label, item.value));
      });
    });

    exports.initInspector = initInspector;
  });
}
