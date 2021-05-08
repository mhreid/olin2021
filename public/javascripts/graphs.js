$(document).ready(function() {
  var drinkGoal = 2018;
  var startDate = new Date(2018, 4, 12, 5, 0, 0); // new Date(2016, 4, 6, 21, 0, 0);
  var endDate = new Date(2018, 4, 20, 13, 0, 0); // new Date(2016, 4, 15, 13, 0, 0);

  var width = $(".container-fluid").width();
  var heightWidthRatio = 1/2;
  var height = width * heightWidthRatio;

  var topRhtPad = 15;
  var btmLftPad = 50;

  var x = d3.time.scale()
              .domain([startDate, endDate])
              .range([btmLftPad, width-topRhtPad]);

  var y = d3.scale.linear()
              .domain([0, drinkGoal])
              .range([height-btmLftPad, topRhtPad]);

  var svg = d3.select(".chart#burn-rate")
              .append("svg")
                .attr("width", width)
                .attr("height", height);

  var xAxis = d3.svg.axis()
                .scale(x)
                .orient("bottom")
                .tickSize(y.range()[1] - y.range()[0], 0, 1)
                .tickFormat(d3.time.format("%b %d"));

  var xTicks = svg.append("g")
                  .attr("class", "x-ticks")
                  .attr("transform", "translate(0,"+y(0)+")")
                  .call(xAxis);

  var yAxis = d3.svg.axis()
                .scale(y)
                .orient("left")
                .tickSize(x.range()[0] - x.range()[1], 0, 1)
                .tickFormat(d3.format(".0f"));

  var yTicks = svg.append("g")
                  .attr("class", "y-ticks")
                  .attr("transform", "translate("+x(startDate.getTime())+",0)")
                  .call(yAxis);

  var line = d3.svg.line()
               .x(function (drink) { return x(new Date(drink.date)); })
               .y(function (drink) { return y(drink.cumTotal); });

  var benchmarkPath = svg.append("g")
                         .attr("class", "path benchmark")
                            .append("path")
                               .datum([
                                    { date: startDate, cumTotal: 0 },
                                    { date: endDate, cumTotal: drinkGoal },
                                    { date: endDate, cumTotal: 0 },
                                  ])
                               .attr("d", line);

  var tallyPath = svg.append("g")
                     .attr("class", "path tally");

  d3.json("/api/drinks", function(err, drinks) {
    drinks = _.sortBy(drinks, function(drink) { return drink.date; });
    var cumTotal = 0;
    _.each(drinks, function(drink) {
      cumTotal += drink.servings;
      drink.cumTotal = cumTotal;
    });
    drinks = _.union([{date: startDate, cumTotal: 0}], drinks);

    tallyPath.append("path")
             .datum(drinks)
             .attr("d", line);
  });
});
