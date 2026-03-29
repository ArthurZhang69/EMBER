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

// ── Placeholder — implementation in progress ──────────────────────────────────

/** Continuous WRI visualisation parameters (green → yellow → orange → red). */
var WRI_VIS = {
  min: 0, max: 1,
  palette: ['#1a9641', '#a6d96a', '#ffffbf', '#fdae61', '#d7191c']
};

/** Discrete risk class colours: Low=green, Medium=orange, High=red. */
var CLASS_VIS = {
  min: 1, max: 3,
  palette: ['#1a9641', '#fdae61', '#d7191c']
};

exports.WRI_VIS   = WRI_VIS;
exports.CLASS_VIS = CLASS_VIS;
