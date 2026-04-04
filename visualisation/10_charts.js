/**
 * 10_charts.js
 * EMBER — Earth Monitoring of Burn Exposure Risk
 *
 * Module: Visualisation II / Analysis II — Risk Breakdown Chart
 * Owners: Team Members D & F
 *
 * Renders a bar / pie chart showing the proportion of High / Medium / Low
 * risk area within the user AOI. Updates dynamically when AOI or weights change.
 */

/**
 * Build a horizontal bar chart showing High / Medium / Low risk area proportions.
 * @param {ee.Dictionary} stats - Output of computeZonalStats
 * @param {ui.Panel}      targetPanel - Panel to add the chart into
 */
function buildRiskChart(stats, targetPanel) {
  targetPanel.clear();

  // Evaluate server-side dictionary values client-side before rendering
  stats.evaluate(function(s) {
    if (!s) {
      targetPanel.add(ui.Label('No results yet.', {fontSize: '11px', color: '#aaa'}));
      return;
    }

    var highPct = s.high.pct.toFixed(1);
    var medPct  = s.medium.pct.toFixed(1);
    var lowPct  = s.low.pct.toFixed(1);
    var highKm  = s.high.area.toFixed(0);
    var medKm   = s.medium.area.toFixed(0);
    var lowKm   = s.low.area.toFixed(0);

    // Use GEE ui.Chart with a simple DataTable
    var chartData = [
      ['Risk Class', 'Area (km²)', {role: 'style'}, {role: 'annotation'}],
      ['High',   parseFloat(highKm), '#d7191c', highPct + '% · ' + highKm + ' km²'],
      ['Medium', parseFloat(medKm),  '#fdae61', medPct  + '% · ' + medKm  + ' km²'],
      ['Low',    parseFloat(lowKm),  '#1a9641', lowPct  + '% · ' + lowKm  + ' km²']
    ];

    var chart = ui.Chart(chartData)
      .setChartType('BarChart')
      .setOptions({
        title:       'Risk Area Breakdown',
        titleTextStyle: {fontSize: 12, bold: true},
        hAxis:       {title: 'Area (km²)', minValue: 0},
        vAxis:       {title: ''},
        legend:      {position: 'none'},
        bar:         {groupWidth: '60%'},
        annotations: {alwaysOutside: false},
        height:      160,
        colors:      ['#d7191c']   // overridden per-row by style column
      });

    targetPanel.add(chart);

    // Numeric summary labels below the chart
    var mkRow = function(color, label, pct, km) {
      return ui.Panel([
        ui.Label('■', {color: color, fontSize: '14px', margin: '0 4px 0 0'}),
        ui.Label(label + ': ' + pct + '%  (' + km + ' km²)',
                 {fontSize: '11px', color: '#333'})
      ], ui.Panel.Layout.flow('horizontal'), {margin: '1px 0'});
    };

    targetPanel.add(mkRow('#d7191c', 'High',   highPct, highKm));
    targetPanel.add(mkRow('#fdae61', 'Medium', medPct,  medKm));
    targetPanel.add(mkRow('#1a9641', 'Low',    lowPct,  lowKm));
    targetPanel.add(ui.Label(
      'Total: ' + parseFloat(s.total.toFixed(1)).toLocaleString() + ' km²',
      {fontSize: '11px', color: '#888', margin: '4px 0 0'}
    ));
  });
}

exports.buildRiskChart = buildRiskChart;
