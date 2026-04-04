/**
 * 09_ui_panels.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Visualisation II — Control Panel & UI Components
 * Owner:  Team Member F
 *
 * Builds the left-side control panel containing:
 *   - AOI drawing tool
 *   - Time window selector (month/season dropdown)
 *   - Six factor weight sliders with live normalisation display
 *   - "Run Analysis" button with loading state indicator
 *   - App title, description, and data source links
 */

/**
 * Build the left-side control panel.
 * @param {Function} onRun  - Callback invoked when user clicks Run Analysis.
 *                            Signature: onRun(aoi, start, end, weights, statusLabel)
 * @returns {ui.Panel} The assembled panel (add to ui.root externally)
 */
function buildControlPanel(onRun) {
  // ── Styles ──────────────────────────────────────────────────────────
  var S = {
    title:    {fontSize: '18px', fontWeight: 'bold', color: '#d7191c', margin: '4px 0 2px'},
    subtitle: {fontSize: '11px', color: '#888', margin: '0 0 8px'},
    section:  {fontSize: '12px', fontWeight: 'bold', color: '#333', margin: '8px 0 4px'},
    label:    {fontSize: '11px', color: '#555', margin: '2px 0 1px'},
    divider:  {color: '#ddd', margin: '4px 0'},
    status:   {fontSize: '11px', color: '#666', margin: '4px 0'},
    input:    {width: '220px'},
    btn:      {width: '228px', margin: '6px 0'}
  };

  var panel = ui.Panel({
    style: {width: '250px', padding: '10px', backgroundColor: 'white'}
  });

  // ── Header ───────────────────────────────────────────────────────────
  panel.add(ui.Label('🔥 EMBER', S.title));
  panel.add(ui.Label('Earth Monitoring of Burn Exposure Risk', S.subtitle));
  panel.add(ui.Label('──────────────────────────', S.divider));

  // ── Analysis Period ───────────────────────────────────────────────────
  panel.add(ui.Label('Analysis Period', S.section));
  panel.add(ui.Label('Start date (YYYY-MM-DD)', S.label));
  var startBox = ui.Textbox({value: '2023-06-01', style: S.input});
  panel.add(startBox);
  panel.add(ui.Label('End date (YYYY-MM-DD)', S.label));
  var endBox = ui.Textbox({value: '2023-09-01', style: S.input});
  panel.add(endBox);

  // ── Area of Interest ─────────────────────────────────────────────────
  panel.add(ui.Label('──────────────────────────', S.divider));
  panel.add(ui.Label('Area of Interest', S.section));
  panel.add(ui.Label(
    'Use the ✏ drawing tools on the map to draw a rectangle or polygon.',
    {fontSize: '11px', color: '#666'}
  ));
  var clearBtn = ui.Button({
    label: '✕  Clear drawn geometry',
    style: {width: '228px', margin: '4px 0'},
    onClick: function() {
      Map.drawingTools().layers().reset();
      Map.drawingTools().stop();
    }
  });
  panel.add(clearBtn);

  // ── Factor Weights ───────────────────────────────────────────────────
  panel.add(ui.Label('──────────────────────────', S.divider));
  panel.add(ui.Label('Factor Weights (0 – 1)', S.section));

  var factorDefs = [
    {label: 'Vegetation Dryness (VDI)', key: 'w1'},
    {label: 'Land Surface Temp  (LST)', key: 'w2'},
    {label: 'Precipitation Deficit(PA)', key: 'w3'},
    {label: 'Wind Speed          (WS)', key: 'w4'},
    {label: 'Terrain Slope    (SLOPE)', key: 'w5'},
    {label: 'Historical Fires   (HFD)', key: 'w6'}
  ];

  var sliders = {};
  factorDefs.forEach(function(f) {
    var valLabel = ui.Label('0.17', {fontSize: '10px', color: '#888'});
    var row = ui.Panel([
      ui.Label(f.label, {fontSize: '10px', color: '#444', width: '160px'}),
      valLabel
    ], ui.Panel.Layout.flow('horizontal'), {margin: '1px 0'});

    var slider = ui.Slider({
      min: 0, max: 1, value: 1 / 6, step: 0.05,
      style: {width: '220px'},
      onChange: function(v) { valLabel.setValue(v.toFixed(2)); }
    });
    sliders[f.key] = slider;
    panel.add(row);
    panel.add(slider);
  });

  // ── Run Button ────────────────────────────────────────────────────────
  panel.add(ui.Label('──────────────────────────', S.divider));
  var statusLabel = ui.Label('', S.status);

  var runBtn = ui.Button({
    label: '▶  Run Analysis',
    style: S.btn,
    onClick: function() {
      statusLabel.setValue('⏳ Running — please wait…');

      var layers = Map.drawingTools().layers();
      if (layers.length() === 0) {
        statusLabel.setValue('⚠ Draw an AOI on the map first, then click Run.');
        return;
      }

      var aoi    = layers.get(0).toGeometry();
      var start  = startBox.getValue();
      var end    = endBox.getValue();
      var weights = {
        w1: sliders.w1.getValue(),
        w2: sliders.w2.getValue(),
        w3: sliders.w3.getValue(),
        w4: sliders.w4.getValue(),
        w5: sliders.w5.getValue(),
        w6: sliders.w6.getValue()
      };

      onRun(aoi, start, end, weights, statusLabel);
    }
  });
  panel.add(runBtn);
  panel.add(statusLabel);

  // ── Results placeholder (populated by main.js after analysis) ────────
  panel.add(ui.Label('──────────────────────────', S.divider));
  panel.add(ui.Label('Risk Breakdown', S.section));
  var resultsPanel = ui.Panel({style: {margin: '0'}});
  panel.add(resultsPanel);

  // ── Data sources ─────────────────────────────────────────────────────
  panel.add(ui.Label('──────────────────────────', S.divider));
  panel.add(ui.Label(
    'Data: MODIS · ERA5-Land · CHIRPS · SRTM · FIRMS\nCASA0025 · UCL CASA',
    {fontSize: '9px', color: '#aaa'}
  ));

  return {panel: panel, resultsPanel: resultsPanel};
}

exports.buildControlPanel = buildControlPanel;
