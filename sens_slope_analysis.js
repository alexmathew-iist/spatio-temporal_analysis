print('Time series modelling of Landsat based vegetation indices');

/*Study Area*/

print('**********************\nStudy Area\n**********************');

/*Specifying Study area*/

var region = Bhitarkanika;
// Export the image sample feature collection to Drive as a shapefile.

Export.table.toDrive({
  collection: region,
  description: 'region',
  folder: 'Bhitarkanika',
  fileFormat: 'SHP'
});

Map.addLayer(region, {}, 'Bhitarkanika Mangroves');
Map.centerObject(region,15);

/*ROIs*/

var groundTruth = ee.FeatureCollection(Bhit_rois);
print('Ground Truth',groundTruth);
Map.addLayer(groundTruth, {}, 'Bhitarkanika ROIs');

var AO = ee.Feature(groundTruth.filter(ee.Filter.eq('CLASS_NAME','AO')).geometry()).set('label','AO');
var AM = ee.Feature(groundTruth.filter(ee.Filter.eq('CLASS_NAME','AM')).geometry()).set('label','AM');
var EA = ee.Feature(groundTruth.filter(ee.Filter.eq('CLASS_NAME','EA')).geometry()).set('label','EA');
var HF = ee.Feature(groundTruth.filter(ee.Filter.eq('CLASS_NAME','HF')).geometry()).set('label','HF');
var classes = ee.FeatureCollection([AO,AM,EA,HF]);

print('A. officianalis (AO)',AO);
print('Classes for analysis',classes);


// Make a list of Features.
var features = [
  ee.Feature(ee.Geometry(AO.geometry()), {name: 'AO'}),
  ee.Feature(ee.Geometry(AM.geometry()), {name: 'AM'}),
  ee.Feature(ee.Geometry(EA.geometry()), {name: 'EA'}),
  ee.Feature(ee.Geometry(HF.geometry()), {name: 'HF'})
];

// Create a FeatureCollection from the list and print it.
var gtCollection = ee.FeatureCollection(features);

print('GT converted Feature collection', gtCollection);

// Export.table(groundTruth);
exports.BhitarkanikaROIs = groundTruth;

/*Setting visualizing parameters*/

var fccVis = {min: 0, max: 0.4000, bands: ['B8','B4', 'B3']};

/*Start and end dates*/

var input_StartStr = ee.String('1988-01-01');
var input_FinishStr = ee.String('2024-01-01');

// Convert text string dates to date tpe
var Start = ee.Date(input_StartStr);
var Finish = ee.Date(input_FinishStr);

print('Dataset\nfrom ',Start,' to ',Finish);

/*Area of Interest*/

var Polygon = region;
print('Area of Interest', region);
Map.addLayer(Polygon,null,'Area of Interest');
Map.centerObject(Polygon,15);

/*Landsat Image Dataset*/

var selected_bands = ['blue','green','red','nir','swir1','swir2','QA_PIXEL'];

// Appling scaling factors.
var applyScaleFactors = function (image) {
  var opticalBands = image.select('SR_.*').multiply(0.0000275).add(-0.2);
  return image.addBands(opticalBands, null, true);
};

// Merge the 3 collections, select, and rename the bands to standard names
var Collection = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2').map(applyScaleFactors)
  .select(['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7','QA_PIXEL'],selected_bands)
  .merge(ee.ImageCollection('LANDSAT/LE07/C02/T1_L2').map(applyScaleFactors)
  .select(['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7','QA_PIXEL'],selected_bands))
  .merge(ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').map(applyScaleFactors)
  .select(['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7','QA_PIXEL'],selected_bands))
  .sort("system:time_start")    // Sort by Date
  .filterDate(Start,Finish)     // Filter by date
  .filterBounds(Polygon)  // Filter by area
  // .filterMetadata("CLOUD_COVER","less_than",75) // Filter by cloud cover
  .map(function(image) {return image.mask(image.select('QA_PIXEL')
                                               .remap([1,5440,21824],[1,1,1],0) // 1...21824 -> 1 = not masked
                                          );
                                    //.clip(Polygon)
                        }
      );

print('Collection of Landsat Scenes',Collection);

/*Function to add Indices, time, and constant variables to Landsat imagery.*/

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
  var tcapBright = image.expression(
    '0.3037 * blue + 0.2793 * green + 0.4743 * red + 0.5585 * nir + 0.5082 * swir1 + 0.1863 * swir2',{
    'blue': image.select('blue'),
    'green': image.select('green'),
    'red': image.select('red'),
    'nir': image.select('nir'),
    'swir1': image.select('swir1'),
    'swir2': image.select('swir2')
  }).rename('TCAP_BRIGHT');
  var tcapGreen = image.expression(
    '- 0.2848 * blue - 0.2435 * green - 0.5436 * red + 0.7243 * nir + 0.0840 * swir1 - 0.1800 * swir2',{
    'blue': image.select('blue'),
    'green': image.select('green'),
    'red': image.select('red'),
    'nir': image.select('nir'),
    'swir1': image.select('swir1'),
    'swir2': image.select('swir2')
  }).rename('TCAP_GREEN');
  var tcapWet = image.expression(
    '0.1509 * blue + 0.1973 * green + 0.3279 * red + 0.3406 * nir - 0.7112 * swir1 - 0.4572 * swir2',{
    'blue': image.select('blue'),
    'green': image.select('green'),
    'red': image.select('red'),
    'nir': image.select('nir'),
    'swir1': image.select('swir1'),
    'swir2': image.select('swir2')
  }).rename('TCAP_WET');
  
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
  .addBands(tcapBright)
  .addBands(tcapGreen)
  .addBands(tcapWet)
  .addBands(ee.Image(years).rename('t')).float()
  .addBands(ee.Image.constant(1));
};

var compositeCollection = Collection.map(addVariables)
                                    .map(function(image){return image.clip(region)});
                                    
print('Collection of Composite images',compositeCollection);

/*Species rois and VOI*/
var VOI = 'NDVI';
print('Variable of Interest (VOI): ',VOI);
var roi = HF;

/*Extracting and Downloading VI Collection*/

print('Extracting and Downloading '+VOI+' Collection');
print('Collection of '+ VOI, compositeCollection.select([VOI]));

// Merging to single band images
var mergeBands = function mergeBands(image, previous) {
  return ee.Image(previous).addBands(image);
};

var INDEX = compositeCollection.map(function(image) {return image.select([VOI])
                                    .rename(ee.String(VOI+'_')
                                    // .cat(image.get('SATELLITE'))
                                    // .cat('_')
                                    .cat(ee.Date(image.get('system:time_start')).format('YYYYMMdd')));
  }).iterate(mergeBands, ee.Image([]));

print(VOI+' as Single image bands',INDEX);

Export.image.toDrive({
        image:INDEX,
        description: VOI + '_' + input_StartStr.getInfo() + '_' + input_FinishStr.getInfo(),
        folder: 'Bhitarkanika',
        region:Polygon,
        scale: 30,
        maxPixels: 10e10
});

/*Extracting the band layer names for dates to export a table of the dates*/

var asList = ee.Image(INDEX).bandNames().map(function (layer) {
  return ee.Feature(null, {Date: ee.String(layer)});
});

var feature_date = ee.FeatureCollection(asList);
print('List of image dates ',feature_date);

var dateList = ee.Image(INDEX).bandNames().map(function(list){
  var year = ee.String(list).slice(5,9);
  var month = ee.String(list).slice(9,11);
  var day = ee.String(list).slice(-2);
  return ee.Feature(null,{year:ee.String(year),month:ee.String(month),day:ee.String(day)});
});
var dateListCollection = ee.FeatureCollection(dateList);

print('Date List',dateListCollection);


Export.table.toDrive({
  collection:dateListCollection,
  description: 'Date_'+VOI+'_' + input_StartStr.getInfo() + '_' + input_FinishStr.getInfo(),
  folder: 'Bhitarkanika'
});

/*SEASONAL TREND ANALYSIS USING SEN'S SLOPE*/

print('*****************************\nSEASONAL '+VOI+' TREND ANALYSIS USING SEN\'S SLOPE\n*****************************');


//observation period
var yearStart = 1988;
var yearEnd = 2023;

var monthStart = 1;
var monthEnd = 12;

if (monthStart >= 1 && monthEnd<=3) {
  var segment = "Q1";
} else if (monthStart >= 4 && monthEnd<=6) {
  var segment = "Q2";
} else if (monthStart >= 7 && monthEnd<=9){
  var segment = "Q3";
} else if (monthStart >= 10 && monthEnd<=12){
  var segment = "Q4";
} else {
  print("Wrong month value");
}

print("Sen\'s slope analysis "+VOI+" for "+segment+" from year "+yearStart+" to "+yearEnd);

// Add observation year as an image property.
var seasonalData =compositeCollection.filter(ee.Filter.calendarRange(monthStart ,monthEnd , 'month'))
.filter(ee.Filter.calendarRange(yearStart, yearEnd, 'year'))
  .map(function(img) {
    return img.set('year', img.date().get('year'));
  });
  
print('seasonal Data',seasonalData);


// Generate lists of images from the year using a join.
var seasonalAnnualJoin = ee.Join.saveAll('same_year').apply({
  primary: seasonalData.distinct('year'),
  secondary: seasonalData,
  condition: ee.Filter.equals({leftField: 'year', rightField: 'year'})
});

print('seasonal Annual Join',seasonalAnnualJoin);

var seasonalStats = ee.ImageCollection(seasonalAnnualJoin.map(function(img) {
  var year = img.get('year');
  var yearCol = ee.ImageCollection.fromImages(img.get('same_year'));
  var max = yearCol.select(VOI).mean();
  var yr = ee.Image.constant(ee.Number(year)).toShort();
  return ee.Image.cat(yr, max).rename(['year', 'max']).set('year', year);
}));

print('seasonal Stats',seasonalStats);

// Calculate time series slope using sensSlope().
var senSlope = seasonalStats.reduce(ee.Reducer.sensSlope());
var geometry = region//.geometry();
// var geometry =shape.geometry();

function getHistogram(sensImg, geometry, title) {
  // Calculate histogram as an ee.Array table.
  var hist = sensImg.select('slope').reduceRegion({
    reducer: ee.Reducer.autoHistogram(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e13,
  });

  // Get the array and extract the bin column and pixel count columns.
  var histArray = ee.Array(hist.get('slope'));
  var binBottom = histArray.slice(1, 0, 1);
  var nPixels = histArray.slice(1, 1, null);

  // Chart the two arrays using the `ui.Chart.array.values` function.
  var histColumnFromArray =
    ui.Chart.array.values({array: nPixels, axis: 0, xLabels: binBottom})
      .setChartType('LineChart')
      .setOptions({
        title: title + ' forest condition trend histogram for '+segment+' from year '+yearStart+' to '+yearEnd+' based on '+VOI,
        hAxis: {title: 'Slope'},
        vAxis: {title: 'Pixel count'},
        pointSize: 0,
        lineSize: 2,
        colors: ['1b7837'],
        legend: {position: 'none'}
      });

  return histColumnFromArray;
}

// Get the slope histogram charts and print them to the console
var histogram = getHistogram(senSlope, geometry, 'Bhitarkanika mangrove')
print(histogram);


// Infer pixel-wise vegetation condition based on sign of the slope.
var cond = ee.Image.cat(senSlope.select('slope').gt(0).rename('greening'),
                        senSlope.select('slope').lt(0).rename('browning'));

// Calculate area under greening and browning
var areaGB = cond.multiply(ee.Image.pixelArea())
                 .reduceRegions(geometry, ee.Reducer.sum(), 30);
                 
                 
// Format results of the greening and browning for use in a table; convert sq m
// to sq km and calculate fraction of each; add as feature properties.
areaGB = areaGB.map(function(feature) {
  var browningSqM = feature.getNumber('browning');
  var greeningSqM = feature.getNumber('greening');
  var forestSqM = feature.area();
  return feature.set({
    'Year':yearStart+'-'+yearEnd,
    'Segment':segment,
    'Index':VOI,
    'Browning sq km': browningSqM.divide(1e6),
    'Browning fraction': browningSqM.divide(forestSqM),
    'Greening sq km': greeningSqM.divide(1e6),
    'Greening fraction': greeningSqM.divide(forestSqM),
  });
});

// Display area summary of vegetation condition as a table "chart".
print(ui.Chart.feature.byFeature(areaGB)
  .setChartType('Table'));
  
print(areaGB);

// Get a download URL for the FeatureCollection.
var downloadUrl = areaGB.getDownloadURL({
  format: 'CSV',
  filename: 'Bhit'+VOI+'_tssResults_'+yearStart+'_'+yearEnd+'_'+segment
});
print('URL for downloading FeatureCollection as CSV', downloadUrl);

// Set visualisation parameters for greening and browning areas; display to map.
var visParams = {
  opacity: 1,
  bands: ['slope'],
  min: -0.1,
  max: 0.1,
  palette:
    ['8c510a',
    // 'd8b365', 'f6e8c3', 
    'ffffff', 
    // 'd9f0d3', '7fbf7b', 
    '1b7837']
};

Map.addLayer(senSlope.clipToCollection(region), visParams, 'Sen\'s slope',false);
Map.addLayer(senSlope.select('slope').gt(0), null, 'Positive Sen\'s slope',false);
Map.addLayer(senSlope.select('slope').lt(0), null, 'Negative Sen\'s slope',false);

Export.image.toDrive({
        image:senSlope.select('slope'),
        description: VOI +'_'+'TSS'+ '_' + segment + '_' + yearStart+'_'+yearEnd,
        folder: 'Bhitarkanika',
        region:Polygon,
        scale: 30,
        maxPixels: 10e10
});

