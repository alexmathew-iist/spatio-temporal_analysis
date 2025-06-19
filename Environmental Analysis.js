var region = Bhitarkanika;
Map.centerObject(region, 12);
var regionPrefix = 'Bhit';

/*******Precipitation (CHIRPS Daily)*********/

var chirpsDaily = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
                  .filter(ee.Filter.date('2019-01-01', '2023-12-31'));
var precipitation = chirpsDaily.select('precipitation');
var precipitationVis = {
  min: 1,
  max: 17,
  palette: ['001137', '0aab1e', 'e7eb05', 'ff4a2d', 'e90000'],
};
Map.addLayer(precipitation, precipitationVis, 'Precipitation',false);

var chart_ppt_yrStack = ui.Chart.image
                .doySeriesByYear({
                  imageCollection: precipitation,
                  bandName: 'precipitation',
                  region: region,
                  regionReducer: ee.Reducer.mean(),
                  scale: 500,
                  sameDayReducer: ee.Reducer.mean(),
                  startDay: 1,
                  endDay: 365
                })
                .setOptions({
                  title: 'Precipitation (CHIRPS Daily)',
                  hAxis: {
                    title: 'Day of year',
                    titleTextStyle: {italic: false, bold: true}
                  },
                  vAxis: {
                    title: 'Precipitation (mm/d)',
                    titleTextStyle: {italic: false, bold: true}
                  },
                  lineWidth: 5,
                  colors: ['39a8a7', '9c4f97'],
                });
print(chart_ppt_yrStack);

var chart_ppt_yr =
    ui.Chart.image
        .series({
          imageCollection: precipitation,
          region: region,
          reducer: ee.Reducer.mean(),
          scale: 500,
          xProperty: 'system:time_start'
        })
        .setSeriesNames(['precipitation'])
        .setOptions({
          title: 'Precipitation (CHIRPS Daily)',
          hAxis: {title: 'Date', titleTextStyle: {italic: false, bold: true}},
          vAxis: {
            title: 'Precipitation (mm/d)',
            titleTextStyle: {italic: false, bold: true}
          },
          lineWidth: 5,
          colors: ['e37d05', '1d6b99'],
          curveType: 'function'
        });
print(chart_ppt_yr);

var pptMonthly_mean = ee.ImageCollection(
  ee.List.sequence(2019, 2023).map(function(year) {
    return ee.List.sequence(1, 12).map(function(month) {
      var start = ee.Date.fromYMD(year, month, 1);
      var end = start.advance(1, 'month');
      var monthlyMean = precipitation.filterDate(start, end)
                                   .mean()
                                   .set('system:time_start', start);
      return monthlyMean;
    });
  }).flatten()
);
var pptMonthly_max = ee.ImageCollection(
  ee.List.sequence(2019, 2023).map(function(year) {
    return ee.List.sequence(1, 12).map(function(month) {
      var start = ee.Date.fromYMD(year, month, 1);
      var end = start.advance(1, 'month');
      var monthlyMax = precipitation.filterDate(start, end)
                                   .max()
                                   .set('system:time_start', start);
      return monthlyMax;
    });
  }).flatten()
);

var pptMonthly_cummul = ee.ImageCollection(
  ee.List.sequence(2019, 2023).map(function(year) {
    return ee.List.sequence(1, 12).map(function(month) {
      var start = ee.Date.fromYMD(year, month, 1);
      var end = start.advance(1, 'month');
      var monthlyCummul = precipitation.filterDate(start, end)
                                   .sum()
                                   .set('system:time_start', start);
      return monthlyCummul;
    });
  }).flatten()
);

var chart_ppt_monthly =
    ui.Chart.image
        .series({
          imageCollection: pptMonthly_mean,
          region: region,
          reducer: ee.Reducer.mean(),
          scale: 500,
          xProperty: 'system:time_start'
        })
        .setSeriesNames(['precipitation'])
        .setOptions({
          title: 'Monthly Mean Precipitation (CHIRPS Daily)',
          hAxis: {title: 'Date', titleTextStyle: {italic: false, bold: true}},
          vAxis: {
            title: 'Precipitation (mm/d)',
            titleTextStyle: {italic: false, bold: true}
          },
          lineWidth: 5,
          colors: ['e37d05', '1d6b99'],
          curveType: 'function'
        });
print(chart_ppt_monthly);
