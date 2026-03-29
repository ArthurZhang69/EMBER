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

// ── Placeholder — implementation in progress ──────────────────────────────────

/**
 * Initialise the click inspector and attach it to the map.
 * @param {ee.Image} wri       - WRI image for value sampling
 * @param {ee.Image} normBands - Multi-band normalised factors image
 * @param {ee.Image} firms     - Historical fire density image
 */
function initInspector(wri, normBands, firms) {
  // TODO: implement click listener and panel display
}

exports.initInspector = initInspector;
