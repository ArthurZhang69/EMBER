<p align="center">
  <img src="EMBER_LOGO.svg" width="480" alt="EMBER — Earth Monitoring of Burn Exposure Risk"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Google%20Earth%20Engine-4285F4?style=flat&logo=google&logoColor=white" alt="GEE"/>
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"/>
</p>

<p align="center">
  <strong>Earth Monitoring of Burn Exposure Risk</strong><br/>
  CASA0025 Group Project — Building Spatial Applications with Big Data
</p>

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Problem Statement](#problem-statement)
- [Target Users](#target-users)
- [Application Features](#application-features)
- [Data Sources](#data-sources)
- [Methodology](#methodology)
- [Repository Structure](#repository-structure)
- [Team & Contributions](#team--contributions)
- [How to Use](#how-to-use)
- [Limitations](#limitations)
- [References & Citations](#references--citations)

---

## Project Overview

**EMBER** (Earth Monitoring of Burn Exposure Risk) is an interactive web application built on **Google Earth Engine (GEE)** that assesses and visualises wildfire risk across user-defined regions globally. By combining multiple satellite-derived environmental variables — including vegetation dryness, precipitation anomalies, temperature, wind speed, terrain slope, and historical fire occurrence — EMBER generates a composite **Wildfire Risk Index (WRI)** that classifies land areas into High, Medium, and Low risk zones.

The application is designed to support pre-season fire risk assessment and resource allocation decisions, providing actionable spatial insights without requiring users to have a background in remote sensing or GIS.

**Live Application:** https://arthurzhang69.github.io/EMBER/

**GitHub Repository:** https://github.com/ArthurZhang69/EMBER

---

## Problem Statement

Wildfires are becoming increasingly frequent and severe under climate change, causing devastating losses to ecosystems, infrastructure, and human lives. Effective wildfire management requires anticipating where fires are most likely to ignite and spread **before** they occur.

Existing risk tools are often:
- Geographically limited (e.g. US-only datasets)
- Not interactive or accessible to non-specialists
- Static snapshots rather than dynamically queryable systems

EMBER addresses these gaps by providing a **globally applicable, interactive, and dynamically updated** wildfire risk assessment platform built on cloud-based satellite data.

---

## Target Users

**Primary:** Local government emergency management departments and forestry/land management agencies who need to identify high-risk zones within their jurisdiction ahead of fire season in order to pre-position resources and issue early warnings.

**Secondary:** Environmental researchers and journalists seeking to contextualise wildfire risk across regions and time periods.

---

## Application Features

| Feature | Description |
|---|---|
| 🗺️ **Interactive Map** | Pan, zoom, and explore the risk index layer globally |
| ✏️ **Custom AOI Drawing** | Draw a region of interest directly on the map |
| 📅 **Time Window Selector** | Choose a seasonal time window for analysis (e.g. summer months) |
| 🎚️ **Factor Weight Sliders** | Adjust the relative weight of each risk factor |
| 📊 **Risk Summary Chart** | View breakdown of High/Medium/Low risk area proportions within AOI |
| 🏷️ **Risk Classification Legend** | Clear colour-coded legend for map interpretation |
| 📍 **Click Inspector** | Click any pixel to see individual factor values at that location |

---

## Data Sources

All datasets are available in the **Google Earth Engine public catalogue** and require no separate download.

| Factor | Dataset | GEE Identifier | Resolution | Temporal Coverage |
|---|---|---|---|---|
| Vegetation Dryness (NDVI) | MODIS Terra Vegetation Indices | `MODIS/061/MOD13Q1` | 250m / 16-day | 2000–present |
| Land Surface Temperature | MODIS Terra LST | `MODIS/061/MOD11A1` | 1km / daily | 2000–present |
| Precipitation Anomaly | CHIRPS Daily Precipitation | `UCSB-CHG/CHIRPS/DAILY` | ~5.5km / daily | 1981–present |
| Wind Speed | ERA5-Land Reanalysis | `ECMWF/ERA5_LAND/DAILY_AGGR` | ~11km / daily | 1950–present |
| Terrain Slope | SRTM Digital Elevation Model | `USGS/SRTMGL1_003` | 30m / static | Static |
| Historical Fire Points | MODIS Active Fire (FIRMS) | `FIRMS` | 1km / daily | 2000–present |

> **Note:** All datasets are openly licensed with no restrictions on use, redistribution, or publication.

---

## Methodology

### Risk Index Calculation

The **Wildfire Risk Index (WRI)** is a weighted composite of six normalised environmental factors:

```
WRI = w₁·VDI + w₂·LST + w₃·PA + w₄·WS + w₅·SLOPE + w₆·HFD
```

Where:
- `VDI` = Vegetation Dryness Index (inverse NDVI, normalised 0–1)
- `LST` = Land Surface Temperature anomaly (normalised 0–1)
- `PA` = Precipitation Anomaly — deviation from 90-day rolling mean (normalised 0–1)
- `WS` = Wind Speed (normalised 0–1)
- `SLOPE` = Terrain Slope in degrees (normalised 0–1)
- `HFD` = Historical Fire Density — fire point frequency 2000–present (normalised 0–1)
- `w₁...w₆` = user-adjustable weights (default equal weighting, sum to 1)

### Risk Classification

| WRI Score | Risk Class | Map Colour |
|---|---|---|
| 0.67 – 1.00 | 🔴 High Risk | Red |
| 0.33 – 0.67 | 🟠 Medium Risk | Orange |
| 0.00 – 0.33 | 🟢 Low Risk | Green |

### Pre-processing Steps

1. Filter each ImageCollection to the user-specified time window
2. Apply cloud masking where applicable (MODIS QA bands)
3. Calculate seasonal composites (mean/median aggregation)
4. Compute anomalies relative to long-term baseline (2000–2020)
5. Normalise all bands to 0–1 range using min-max scaling
6. Apply terrain masking (exclude water bodies and permanent ice)
7. Compute weighted composite to produce WRI

---

## Repository Structure

```
📦 EMBER/
│
├── 📁 preprocessing/
│   ├── 01_data_import.js          # Load and filter all datasets
│   ├── 02_cloud_masking.js        # QA-based cloud masking for MODIS
│   ├── 03_anomaly_calculation.js  # Compute precipitation & LST anomalies
│   └── 04_normalisation.js        # Min-max normalisation for all factors
│
├── 📁 analysis/
│   ├── 05_risk_index.js           # Composite WRI calculation
│   ├── 06_classification.js       # High/Medium/Low risk thresholding
│   └── 07_zonal_stats.js          # Area statistics within user AOI
│
├── 📁 visualisation/
│   ├── 08_map_layers.js           # Map styling, colour ramps, legends
│   ├── 09_ui_panels.js            # Control panel, sliders, buttons
│   ├── 10_charts.js               # Risk breakdown chart
│   └── 11_inspector.js            # Click-to-inspect pixel values
│
├── 📁 app/
│   ├── main.js                    # Entry point — assembles all modules
│   └── index.html                 # Landing page with embedded GEE app
│
├── 📁 docs/
│   ├── methodology.md             # Extended methodology notes
│   └── data_dictionary.md         # Variable definitions and units
│
├── EMBER_LOGO.svg                 # Project logo
├── README.md                      # This file
├── CONTRIBUTIONS.md               # Team contributions & milestones
├── PROGRESS.md                    # Live project progress tracker
└── LICENSE
```

---

## Team & Contributions

| Team Member | Role | Responsibilities |
|---|---|---|
| ChuHao Xu | **Preprocessing** | Data import, cloud masking (`01–02`) |
| FangZheng Zhou | **Preprocessing + Analysis** | Anomaly calculation, normalisation (`03–04`) |
| ZheXiang Zhou | **Analysis** | WRI calculation, classification (`05–06`) |
| ZiHan Zhang | **Analysis + Visualisation** | Zonal statistics, charts (`07`) |
| JiaHui Li | **Visualisation** | Inspector panel (`11`) |
| Arthur Zhang | **Visualisation + Docs** | Map layers, UI, HTML page, documentation (`08–10`) |

See [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) for detailed task lists, milestones, and GitHub commit conventions.

---

## How to Use

### Option A — Access the Published App
1. Open the live application: `https://arthurzhang69.github.io/EMBER/`
2. No login required for viewing
3. Use the control panel on the left to select a time window, draw your area of interest, adjust factor weights, and click **Run Analysis**
4. Click any point on the map to inspect individual factor values

### Option B — Run in GEE Code Editor
1. Sign in to [Google Earth Engine](https://code.earthengine.google.com)
2. Clone this repository and open `app/main.js`
3. Click **Run** to execute the script

---

## Limitations

- **Spatial resolution:** The composite WRI is limited to ~1km resolution due to ERA5 and CHIRPS inputs
- **Temporal lag:** Near-real-time analysis may have 1–2 day data latency for MODIS products
- **CHIRPS coverage:** Precipitation data covers 60°N–60°S only; polar AOIs will have missing precipitation input
- **Equal weighting defaults:** Optimal factor weights vary by ecosystem type and region
- **No ignition probability modelling:** The WRI reflects environmental *conditions* conducive to fire, not ignition probability per se

---

## References & Citations

> Restif, C. & Hoffman, A. (2020). *How to generate wildfire boundary maps with Earth Engine.* Google Earth Medium Blog. https://medium.com/google-earth/how-to-generate-wildfire-boundary-maps-with-earth-engine-b38eadc97a38

> NASA DEVELOP (2023). *Automating Wildfire Risk and Occurrence Mapping in Google Earth Engine.* NASA Applied Sciences. https://appliedsciences.nasa.gov/what-we-do/projects/automating-wildfire-risk-and-occurrence-mapping-google-earth-engine-improve

> Tavakkoli Piralilou, S. et al. (2022). A Google Earth Engine Approach for Wildfire Susceptibility Prediction. *Remote Sensing, 14*(3), 672. https://doi.org/10.3390/rs14030672

> Crowley, M.A. & Liu, T. (2023). Active Fire Monitoring. In: *Cloud-Based Remote Sensing with Google Earth Engine.* Springer. https://doi.org/10.1007/978-3-031-26588-4_46

> UN-SPIDER (2023). *Burn Severity Mapping in Google Earth Engine.* https://www.un-spider.org/advisory-support/recommended-practices/recommended-practice-burn-severity/burn-severity-earth-engine

> Scott, J.H. et al. (2024). *Wildfire Risk to Communities.* USDA Forest Service. https://doi.org/10.2737/RDS-2020-0016-2

---

## License

This project is licensed under the MIT License. See `LICENSE` for details.

---

<p align="center">
  <img src="EMBER_LOGO.svg" width="100" alt="EMBER"/>
  <br/>
  <sub>CASA0025: Building Spatial Applications with Big Data | UCL Centre for Advanced Spatial Analysis</sub>
</p>
