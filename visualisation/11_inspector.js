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
 * Initialise the click inspector panel and attach a map-click listener.
 * When the user clicks a pixel, samples WRI + all factor values and
 * displays them in a floating panel on the right side of the map.
 *
 * @param {ee.Image} wri        - Single-band 'WRI' image [0,1]
 * @param {ee.Image} normBands  - Multi-band image: VDI, LST, PA, WS, SLOPE, HFD
 * @param {ee.Image} classified - 'risk_class' image (1/2/3)
 */
function initInspector(wri, normBands, classified) {
  // ── Build inspector panel ───────────────────────────────────────────
  var panel = ui.Panel({
    style: {
      width:           '220px',
      padding:         '8px',
      backgroundColor: 'rgba(255,255,255,0.92)',
      position:        'bottom-right'
    }
  });

  var titleLabel  = ui.Label('📍 Click Inspector', {fontSize: '13px', fontWeight: 'bold'});
  var coordLabel  = ui.Label('Click a point on the map.', {fontSize: '11px', color: '#888'});
  var wriLabel    = ui.Label('', {fontSize: '12px', fontWeight: 'bold'});
  var classLabel  = ui.Label('', {fontSize: '11px'});
  var divider     = ui.Label('──────────────────', {color: '#ddd', margin: '4px 0'});
  var factorPanel = ui.Panel();

  panel.add(titleLabel);
  panel.add(coordLabel);
  panel.add(wriLabel);
  panel.add(classLabel);
  panel.add(divider);
  panel.add(factorPanel);

  Map.add(panel);

  // ── Helper: coloured bar for a factor value (0–1) ──────────────────
  function makeFactorRow(name, value) {
    var pct  = (value * 100).toFixed(0);
    var col  = value >= 0.67 ? '#d7191c' : value >= 0.33 ? '#fdae61' : '#1a9641';
    var bar  = ui.Label('█'.repeat(Math.round(value * 12)),
                        {color: col, fontSize: '10px', letterSpacing: '-1px'});
    var lbl  = ui.Label(name + '  ' + (value * 1).toFixed(2),
                        {fontSize: '10px', color: '#444', width: '120px'});
    return ui.Panel([lbl, bar], ui.Panel.Layout.flow('horizontal'),
                    {margin: '1px 0'});
  }

  // ── Class label helper ──────────────────────────────────────────────
  function riskLabel(classVal) {
    if (classVal === 3) return {text: '🔴 High Risk',   color: '#d7191c'};
    if (classVal === 2) return {text: '🟠 Medium Risk', color: '#f4a02b'};
                        return {text: '🟢 Low Risk',    color: '#1a9641'};
  }

  // ── Map click handler ───────────────────────────────────────────────
  var allBands = wri.addBands(normBands).addBands(classified.rename('risk_class'));

  Map.onClick(function(coords) {
    var pt = ee.Geometry.Point([coords.lon, coords.lat]);

    coordLabel.setValue(
      'Lat: ' + coords.lat.toFixed(4) + '   Lon: ' + coords.lon.toFixed(4)
    );
    wriLabel.setValue('Sampling…');
    factorPanel.clear();

    allBands.sample({region: pt, scale: 500, numPixels: 1})
      .first()
      .toDictionary()
      .evaluate(function(vals) {
        if (!vals) {
          wriLabel.setValue('No data at this location.');
          return;
        }

        var wriVal   = vals['WRI']        || 0;
        var classVal = vals['risk_class'] || 1;
        var rl = riskLabel(classVal);

        wriLabel.setValue('WRI Score: ' + wriVal.toFixed(3));
        wriLabel.style().set('color', rl.color);
        classLabel.setValue(rl.text);
        classLabel.style().set('color', rl.color);

        factorPanel.clear();
        var factors = [
          {key: 'VDI',   label: 'Vegetation Dryness'},
          {key: 'LST',   label: 'Land Surf. Temp'},
          {key: 'PA',    label: 'Precip. Deficit'},
          {key: 'WS',    label: 'Wind Speed'},
          {key: 'SLOPE', label: 'Terrain Slope'},
          {key: 'HFD',   label: 'Fire History'}
        ];

        factors.forEach(function(f) {
          factorPanel.add(makeFactorRow(f.label, vals[f.key] || 0));
        });
      });
  });
}

exports.initInspector = initInspector;
