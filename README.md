# spatio-temporal_analysis
Google Earth Engine script for analyzing temporal trends in vegetation using harmonic regression and Sen’s slope. Supports NDVI, EVI, and SAVI time series extraction, seasonal modeling, and trend visualization over custom regions.

# Temporal Vegetation Index Analysis using Harmonic Regression

This project performs seasonal trend analysis of vegetation using satellite-derived vegetation indices (NDVI, EVI, SAVI) with harmonic regression and Sen’s slope for trend detection in Google Earth Engine (GEE).

## 📌 Objective

To analyze temporal patterns in vegetation health using remote sensing indices over a defined region and period. This includes:
- Extracting vegetation index time series.
- Applying harmonic regression to model seasonality.
- Calculating Sen’s slope for monotonic trends.
- Detrending and exporting seasonal patterns.

## 🛰️ Data Used

- **Satellite**: Landsat 5, 7, 8 Surface Reflectance Tier 1
- **Indices**: NDVI, EVI, SAVI
- **Time Range**: Customizable (e.g., 2000–2022)
- **Region**: User-defined (e.g., Bhitarkanika, Odisha)

## 📦 Project Structure

```bash
temporal-vi-analysis/
├── temporal_analysis.js     # Main GEE script for time series analysis
├── README.md                # Project overview and usage guide
└── .gitignore               # Ignored files (for local dev setup if applicable)
