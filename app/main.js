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

// ── Placeholder — implementation in progress ──────────────────────────────────
// Require individual modules once implemented, e.g.:
// var dataImport  = require('users/<username>/EMBER:preprocessing/01_data_import');
// var cloudMask   = require('users/<username>/EMBER:preprocessing/02_cloud_masking');
// ...

print('EMBER: application loaded. Configure AOI and click Run Analysis.');
