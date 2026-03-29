# EMBER — Methodology Notes

## Wildfire Risk Index (WRI)

WRI = w₁·VDI + w₂·LST + w₃·PA + w₄·WS + w₅·SLOPE + w₆·HFD

All factors are normalised to [0, 1] via min-max scaling with 99th-percentile clipping before compositing.

## Risk Classification Thresholds

| WRI Score   | Class  |
|-------------|--------|
| 0.67 – 1.00 | High   |
| 0.33 – 0.67 | Medium |
| 0.00 – 0.33 | Low    |

## Baseline Period

Long-term anomalies (LST, precipitation, NDVI) are computed relative to the 2000–2020 mean.

## Data Processing Pipeline

1. Filter each ImageCollection to user-specified time window
2. Apply cloud masking (MODIS QA bands)
3. Generate seasonal composites (median aggregation)
4. Compute anomalies relative to 2000–2020 baseline
5. Normalise all bands to 0–1 (99th-percentile clip)
6. Mask water bodies (JRC) and permanent ice
7. Compute weighted composite → WRI
8. Classify WRI → High / Medium / Low
