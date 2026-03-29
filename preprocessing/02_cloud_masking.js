/**
 * 02_cloud_masking.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Preprocessing I — Cloud Masking & Seasonal Composites
 * Owner:  Team Member A
 *
 * Applies QA-based cloud masking to MODIS NDVI and LST, masks water bodies
 * (JRC Global Surface Water) and permanent snow/ice, then generates
 * median seasonal composites.
 */

// ── Placeholder — implementation in progress ──────────────────────────────────

/**
 * Apply MODIS QA cloud mask to an image.
 * @param {ee.Image} image - MODIS image with QA band
 * @returns {ee.Image} Cloud-masked image
 */
function applyModisCloudMask(image) {
  // TODO: implement QA-based cloud masking
}

/**
 * Mask water bodies and permanent ice using JRC Global Surface Water.
 * @param {ee.Image} image - Input image
 * @returns {ee.Image} Masked image
 */
function maskWaterAndIce(image) {
  // TODO: implement water / ice masking
}

exports.applyModisCloudMask = applyModisCloudMask;
exports.maskWaterAndIce     = maskWaterAndIce;
