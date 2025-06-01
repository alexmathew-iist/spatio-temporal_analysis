// Pichavaram Mangrove Time Series Analysis Using Sentinel-2 Imagery in GEE

// Import external ROI script
var externalScript = require('repository');
var groundTruth = externalScript.groundTruth;

// Study Area
var region = Pichavaram_TN;
Map.addLayer(region, {}, 'Pichavaram Mangroves', false);
Map.centerObject(region, 15);

// ROI Classes
var groundTruth = PichGridROIs;
Map.addLayer(groundTruth, {}, 'Pichavaram ROIs', false);

var RH = groundTruth.filter(ee.Filter.eq('value', 1));
var AM01 = groundTruth.filter(ee.Filter.eq('value', 2));
var AM02 = groundTruth.filter(ee.Filter.eq('value', 3));
var AM03 = groundTruth.filter(ee.Filter.eq('value', 4));

var classes = ee.FeatureCollection([RH, AM01, AM02, AM03]).flatten();

// Exportable object
exports.pichavaramROIs = groundTruth;

// Visualization parameters
var fccVis = { min: 0, max: 0.4, bands: ['nir', 'red', 'green'] };

// Area of Interest
var Polygon = region.geometry();
Map.addLayer(Polygon, null, 'Area of Interest', false);

// Variable of Interest (VOI)
var roi = RH;
var VOI = 'NDVI';

// Time Period
var Start = ee.Date('2019-01-01');
var Finish = ee.Date('2024-01-01');

// Sentinel-2 Cloud Masking
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000).set('system:time_start', image.get('system:time_start'))
              .copyProperties(image);
}

// Sentinel-2 Harmonized Dataset
var selected_bands = ['aerosols', 'blue', 'green', 'red', 're1', 're2', 're3', 'nir', 're4', 'wvp', 'swir1', 'swir2'];
var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(Start, Finish)
  .filterMetadata('MGRS_TILE', 'equals', '44PLT')
  .filterBounds(Polygon)
  .map(maskS2clouds)
  .map(function (img) { return img.clip(Polygon); })
  .select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9', 'B11', 'B12'], selected_bands);

// Vegetation Indices and Variables
function addVariables(image) {
  var date = image.date();
  var years = date.difference(ee.Date('1970-01-01'), 'year');
  var ndvi = image.normalizedDifference(['nir', 'red']).rename('NDVI');
  var ndwi = image.normalizedDifference(['green', 'nir']);
  var cmri = ndvi.subtract(ndwi).rename('CMRI');
  var evi = image.expression(
    '2.5 * ((nir - red) / (nir + 6 * red - 7.5 * blue + 1))',
    {
      nir: image.select('nir'),
      red: image.select('red'),
      blue: image.select('blue')
    }).rename('EVI');
  var savi = image.expression(
    '1.5 * ((nir - red)/(nir + red + 0.5))',
    {
      nir: image.select('nir'),
      red: image.select('red')
    }).rename('SAVI');
  var tvi = image.expression(
    '0.5 * (120 * (nir - green) - 200 * (red - green))',
    {
      nir: image.select('nir'),
      green: image.select('green'),
      red: image.select('red')
    }).rename('TVI');
  var nirv = image.expression(
    'nir * (nir - red) / (nir + red)',
    {
      nir: image.select('nir'),
      red: image.select('red')
    }).rename('NIRV');

  return image
    .addBands([ndvi, cmri, evi, savi, tvi, nirv])
    .addBands(ee.Image(years).multiply(2 * Math.PI).rename('t')).float()
    .addBands(ee.Image.constant(1));
}

// Cloud Probability Masking
var s2Clouds = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
  .filter(ee.Filter.and(ee.Filter.bounds(Polygon), ee.Filter.date(Start, Finish)));

function maskClouds(img) {
  var cloudMask = ee.Image(img.get('cloud_mask')).select('probability').lt(50);
  return img.updateMask(cloudMask).copyProperties(img);
}

var s2SrWithCloudMask = ee.Join.saveFirst('cloud_mask').apply({
  primary: dataset,
  secondary: s2Clouds,
  condition: ee.Filter.equals({ leftField: 'system:index', rightField: 'system:index' })
});

var compositeCollection = ee.ImageCollection(s2SrWithCloudMask)
  .map(maskClouds)
  .map(addVariables);

// Harmonic Terms
var modSentinelSeries = compositeCollection.map(function (image) {
  var t = image.select('t');
  return image.addBands([
    t.cos().rename('cos1'),
    t.sin().rename('sin1'),
    t.multiply(2).cos().rename('cos2'),
    t.multiply(2).sin().rename('sin2')
  ]);
});

// Trend Analysis (Linear)
var independents = ee.List(['constant', 't']);
var trend = modSentinelSeries.select(independents.add(VOI))
  .reduce(ee.Reducer.linearRegression(independents.length(), 1));
var coefficients = trend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([independents]);

// Detrending
modSentinelSeries = modSentinelSeries.map(function (img) {
  var detrended = img.select(VOI).subtract(
    img.select(independents).multiply(coefficients).reduce('sum')
  ).rename('detrended' + VOI);
  return img.addBands(detrended);
});

// Extended Harmonic Regression
var extIndependents = ee.List(['constant', 't', 'cos1', 'sin1', 'cos2', 'sin2']);
var extHarTrend = modSentinelSeries.select(extIndependents.add(VOI))
  .reduce(ee.Reducer.linearRegression(extIndependents.length(), 1));
var extHarTrendCoefficients = extHarTrend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([extIndependents]);

// Export extended harmonic coefficients
Export.image.toDrive({
  image: extHarTrendCoefficients,
  description: 'PichS2_' + VOI + '_coeffHar',
  folder: 'Pichavaram_S2Collection',
  region: region,
  scale: 10,
  maxPixels: 1e13
});

// Fitted Image Series
var fittedExtHarmonic = modSentinelSeries.map(function (image) {
  return image.addBands(
    image.select(extIndependents)
      .multiply(extHarTrendCoefficients)
      .reduce('sum')
      .rename('extFitted')
  );
});
