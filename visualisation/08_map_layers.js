/**
 * 08_map_layers.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Visualisation II — Map Layer Styling
 * Owner:  Team Member F
 *
 * Configures continuous WRI colour ramp, discrete risk classification layer,
 * historical fire points layer, basemap switcher, and the colour legend widget.
 */

var layerControlPanel = null;
var basemapPanel = null;
var riskOpacitySlider = null;

function removeExistingPanel(panelRef) {
  if (panelRef) {
    Map.remove(panelRef);
  }
}

function buildBasemapSelector() {
  removeExistingPanel(basemapPanel);

  var panel = ui.Panel({
    style: {
      position: 'top-left',
      padding: '10px',
      backgroundColor: 'rgba(255,255,255,0.95)',
      width: '250px'
    }
  });

  panel.add(ui.Label('Basemap', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '0 0 4px 0'
  }));

  var select = ui.Select({
    items: ['HYBRID', 'TERRAIN', 'SATELLITE', 'ROADMAP'],
    value: 'HYBRID',
    style: {width: '230px'},
    onChange: function(value) {
      Map.setOptions(value);
    }
  });

  panel.add(select);
  basemapPanel = panel;
  Map.add(panel);
}

function buildLayerControls(wriLayer, classLayer, fire30Layer, fire7Layer) {
  removeExistingPanel(layerControlPanel);

  var panel = ui.Panel({
    style: {
      position: 'top-left',
      padding: '10px',
      backgroundColor: 'rgba(255,255,255,0.95)',
      width: '250px',
      margin: '80px 0 0 0'
    }
  });

  panel.add(ui.Label('Layer Controls', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '0 0 6px 0'
  }));

  var wriCheckbox = ui.Checkbox({
    label: 'WRI Continuous',
    value: wriLayer.getShown(),
    onChange: function(v) {
      wriLayer.setShown(v);
    }
  });

  var classCheckbox = ui.Checkbox({
    label: 'Risk Classes',
    value: classLayer.getShown(),
    onChange: function(v) {
      classLayer.setShown(v);
    }
  });

  var fire30Checkbox = ui.Checkbox({
    label: 'Active Fires — 30 days',
    value: fire30Layer ? fire30Layer.getShown() : false,
    onChange: function(v) {
      if (fire30Layer) fire30Layer.setShown(v);
    }
  });

  var fire7Checkbox = ui.Checkbox({
    label: 'Active Fires — 7 days',
    value: fire7Layer ? fire7Layer.getShown() : false,
    onChange: function(v) {
      if (fire7Layer) fire7Layer.setShown(v);
    }
  });

  panel.add(wriCheckbox);
  panel.add(classCheckbox);
  panel.add(fire30Checkbox);
  panel.add(fire7Checkbox);

  panel.add(ui.Label('Risk Class Opacity', {
    fontSize: '11px',
    color: '#555',
    margin: '8px 0 2px 0'
  }));

  riskOpacitySlider = ui.Slider({
    min: 0,
    max: 1,
    value: 0.75,
    step: 0.05,
    style: {width: '230px'},
    onChange: function(v) {
      classLayer.setOpacity(v);
    }
  });

  panel.add(riskOpacitySlider);

  layerControlPanel = panel;
  Map.add(panel);
}

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

  return {
    wriLayer: wriLayer,
    classLayer: classLayer
  };
}

function getFireLayersFromMap() {
  var fire30Layer = null;
  var fire7Layer = null;

  var layers = Map.layers();
  for (var i = 0; i < layers.length(); i++) {
    var lyr = layers.get(i);
    var name = lyr.getName();

    if (name === 'Active Fires — 30 days') fire30Layer = lyr;
    if (name === 'Active Fires — 7 days (latest)') fire7Layer = lyr;
  }

  return {
    fire30Layer: fire30Layer,
    fire7Layer: fire7Layer
  };
}




exports.buildBasemapSelector = buildBasemapSelector;
exports.buildLayerControls = buildLayerControls;
exports.addAnalysisLayers = addAnalysisLayers;
exports.getFireLayersFromMap = getFireLayersFromMap;
