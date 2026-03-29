/**
 * 07_zonal_stats.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Analysis II — Zonal Statistics
 * Owner:  Team Member D
 *
 * Computes area statistics (km², %) for each risk class within the user AOI,
 * plus per-factor contribution ranking to help users understand risk drivers.
 */

// ── Placeholder — implementation in progress ──────────────────────────────────

/**
 * Compute area breakdown by risk class within AOI.
 * @param {ee.Image}    classified - Classified risk image (1/2/3)
 * @param {ee.Geometry} aoi        - User-defined area of interest
 * @returns {ee.Dictionary} Area (km²) and proportion (%) per class
 */
function computeZonalStats(classified, aoi) {
  // TODO: implement zonal area statistics
}

exports.computeZonalStats = computeZonalStats;
