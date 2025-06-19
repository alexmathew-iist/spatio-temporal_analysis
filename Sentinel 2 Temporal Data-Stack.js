var Polygon = Pichavaram;
Map.centerObject(Polygon)
/*Start and end dates*/

var input_StartStr = ee.String('2019-01-01');
var input_FinishStr = ee.String('2026-01-01');

// Convert text string dates to date type
var Start = ee.Date(input_StartStr);
// var Finish = ee.Date(input_FinishStr);
var Finish = ee.Date(Date.now());


print('Dataset\nfrom ',Start,' to ',Finish);

/*Function to mask clouds (Preliminary masking)*/

function maskS2clouds(image) {
  var qa = image.select('QA60');
  var date = image.get('system:time_start');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000).set('system:time_start', date)
  .copyProperties(image);
}

/*Sentinel 2 Image dataset*/

var selected_bands = ['aerosols','blue','green','red','re1','re2','re3','nir','re4','wvp','swir1','swir2'];

var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                  .filterDate(Start, Finish)
                  .filterBounds(Polygon)
                  .map(maskS2clouds)
                  .select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9', 'B11', 'B12'],selected_bands);
// print(dataset)                  
print("Available bands: \n'aerosols','blue','green',",
"'red','re1','re2',",
"'re3','nir','re4',",
"'wvp','swir1','swir2'")
// print('Dataset (After preliminary masking)',dataset);

/*Function to add Indices, time, and constant variables to Sentinel imagery.*/

var addVariables = function(image) {

    var date = image.date();
    var years = date.difference(ee.Date('1970-01-01'), 'year');
    var ndvi = image.normalizedDifference(['nir', 'red']).rename('NDVI');
    var ndwi = image.normalizedDifference(['green', 'nir']).rename('NDWI');
    var cmri = ndvi.subtract(ndwi).rename('CMRI');
    var ndmi = image.normalizedDifference(['nir', 'swir1']).rename('NDMI');
    var grvi =image.normalizedDifference(['green','red']).rename('GRVI');
    var evi = image.expression(
      '2.5 * ((nir - red) / (nir + 6 * red - 7.5 * blue + 1))',
      {
        'nir': image.select('nir'),  // NIR band
        'red': image.select('red'),  // Red band
        'blue': image.select('blue')   // Blue band
      }
    ).rename('EVI');
    var savi = image.expression(
      '1.5 * ((nir - red)/(nir + red + 0.5))',
      {
        'nir': image.select('nir'),  // NIR band
        'red': image.select('red'),  // Red band
        }
      ).rename('SAVI');
    var mvi = image.expression(
      '(nir - green) / (swir1 - green)',
    {
        'nir': image.select('nir'),  // NIR band
        'green': image.select('green'),  // Green band
        'swir1': image.select('swir1'),  // SWIR band    
    }).rename('MVI');
    var tvi = image.expression(
      '0.5 * (120 * (nir - green) - 200 * (red - green))',
    {
        'nir': image.select('nir'),  // NIR band
        'green': image.select('green'),  // Green band
        'red': image.select('red'),  // Red band    
    }).rename('TVI');
    var nirv = image.expression(
      'nir * (nir - red) / (nir + red)',
    {
        'nir': image.select('nir'),  // NIR band
        'red': image.select('red'),  // Red band
    }).rename('NIRV'); 
    var remi = image.expression(
      '(re2 - red) / (swir1 - green)',
      {
        're2':image.select('re2'),
        'red':image.select('red'),
        'swir1':image.select('swir1'),
        'green':image.select('green')
      }).rename('REMI')
    return image
    .addBands(ndvi)
    .addBands(ndwi)
    .addBands(cmri)
    .addBands(ndmi)
    .addBands(grvi)
    .addBands(evi)
    .addBands(savi)
    .addBands(mvi)
    .addBands(tvi)
    .addBands(nirv)
    .addBands(remi)
    .addBands(ee.Image(years).multiply(2 * Math.PI).rename('t')).float()
    .addBands(ee.Image.constant(1));
  };

print("Available indices: \n'NDVI','NDWI','CMRI',",
"'NDMI','GRVI','EVI',",
"'SAVI','MVI','TVI',",
"'NIRv','REMI'");

/*Cloud masking using Cloud Probability Image Collection*/

var s2Clouds = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY');

var MAX_CLOUD_PROBABILITY = 75;
function maskClouds(img) {
  var clouds = ee.Image(img.get('cloud_mask')).select('probability');
  var isNotCloud = clouds.lt(MAX_CLOUD_PROBABILITY);
  return img.updateMask(isNotCloud).copyProperties(img);
}

// Filter input collections by desired data range and region.
var criteria = ee.Filter.and(
    ee.Filter.bounds(Polygon), ee.Filter.date(Start, Finish));

var s2Clouds = s2Clouds.filter(criteria);


// Join S2 SR with cloud probability dataset to add cloud mask.
var s2SrWithCloudMask = ee.Join.saveFirst('cloud_mask').apply({
  primary: dataset,
  secondary: s2Clouds,
  condition:
      ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})
});
var compositeCollection = ee.ImageCollection(s2SrWithCloudMask).map(maskClouds)
                        .map(addVariables);
