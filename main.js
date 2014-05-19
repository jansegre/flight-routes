var d3 = require('d3/d3');
require('./lib/d3.geo.zoom');
var topojson = require('topojson/topojson');
var PriorityQueue = require('priorityqueuejs');

var degrees = 180 / Math.PI,
    width = 900,
    height = 560;

var projection = orthographicProjection(width, height)
    .scale(800)
    .rotate([53, 14, 0])
    .precision(.01)
    .translate([width / 2, height / 2]);

var path = d3.geo.path().projection(projection)
    .pointRadius(5);

var svg = d3.select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(drawMap, path, true);

svg.selectAll(".foreground")
    .call(drawMap, path, true)
    .call(d3.geo.zoom().projection(projection)
        .scaleExtent([projection.scale() * .35, projection.scale() * 7])
        .on("zoom.redraw", function() {
            d3.event.sourceEvent.preventDefault();
            svg.selectAll("path").attr("d", path);
        }));


var loader = d3.dispatch("world"), id = -1;
loader.on("world." + ++id, function() { svg.selectAll("path").attr("d", path); });

d3.json("world-110m.json", function(error, world) {
  if (error) {
    //TODO: better error handling
    console.log("An error occurred: " + (error.msg || error));
    return;
  }
  svg.insert("path", ".foreground")
      .datum(topojson.feature(world, world.objects.land))
      .attr("class", "land");
  svg.insert("path", ".foreground")
      .datum(topojson.mesh(world, world.objects.countries))
      .attr("class", "mesh");
  loader.world();
});

var airport_a, airport_b;
var select_a = true;
var airport_graph = {};

d3.json("tam_airports.json", function(error, airports) {
  if (error) {
    //TODO: better error handling
    console.log("An error occurred: " + (error.msg || error));
    return;
  }

  for (var i = 0; i < airports.length; i++) {
    var airport = airports[i];
    airport.neighbours = {};
    airport.coordinates = [airport.longitude, airport.latitude];
    airport_graph[airport.iata] = airport;
  }

  svg.selectAll("path.airport")
      .data(airports.map(function (a) {
          return {type: "Point", coordinates: a.coordinates, iata: a.iata, projection: projection}
      }))
      .enter()
      .append("path")
      .attr("class", "airport")
      .attr("d", projection)
      .on("click", function(d, i) {
          if (select_a) airport_a = d;
          else {
              airport_b = d;
              var dijk = dijkstra(airport_graph, airport_a.iata, airport_b.iata);
              var lines = svg.selectAll("path.line")
                .data(dijk.route.map(function(r) {
                  var a = airport_graph[r[0]].coordinates;
                  var b = airport_graph[r[1]].coordinates;
                  return {type: "LineString", coordinates: [a, b], route: r.join("-")}
                }))
                .attr("d", path)
              lines.enter()
                .append("path")
                .attr("class", "line")
                .attr("d", path);
              lines.exit()
                .remove();
          }
          select_a = !select_a;
          console.log(i);
          console.log(d);
      });
  loader.world();
});

var routes;

//TODO: allow choosing a day, not a main feature
d3.json("tam_routes_20141002.json", function(error, _routes) {
  if (error) {
    //TODO: better error handling
    console.log("An error occurred: " + (error.msg || error));
    return;
  }
  routes = _routes;

  for (var route_name in routes) {
    var orig = route_name.split("-")[0];
    var dest = route_name.split("-")[1];
    var route = routes[route_name];

    if (typeof route != "string") for (var i = 0; i < route.length; i++) {
      var r = route[i];
      r.departure = new Date(r.departure.slice(0,-1) + "-0300");
      r.arrival = new Date(r.arrival.slice(0,-1) + "-0300");
      r.crawled_at = new Date(r.crawled_at.slice(0,-1) + "-0300");
      r.min_price = (r.prices.length > 1 ? r.prices.reduce(function(a, c) {
        return (a.price + a.tax < c.price + c.tax )? a : c;
      }) : r.prices[0]);

      var n = (airport_graph[orig].neighbours[dest] = airport_graph[orig].neighbours[dest] || []);
      n.push(r);
    }
  }

  loader.world();
});

function drawMap(svg, path, mousePoint) {
  svg.append("path")
      .datum(d3.geo.graticule())
      .attr("class", "graticule")
      .attr("d", path);

  svg.append("path")
      .datum({type: "Sphere"})
      .attr("class", "foreground")
      .attr("d", path)
      .on("mousedown.grab", function() {
        var point;
        if (mousePoint) point = svg.insert("path", ".foreground")
            .datum({type: "Point", coordinates: projection.invert(d3.mouse(this))})
            .attr("class", "point")
            .attr("d", path);
        var path = d3.select(this).classed("zooming", true),
            w = d3.select(window).on("mouseup.grab", function() {
              path.classed("zooming", false);
              w.on("mouseup.grab", null);
              if (mousePoint) point.remove();
            });
      });
}

function orthographicProjection(width, height) {
  return d3.geo.orthographic()
      .precision(.5)
      .clipAngle(90)
      .clipExtent([[1, 1], [width - 1, height - 1]])
      .translate([width / 2, height / 2])
      .scale(width / 2 - 10)
      .rotate([0, -30]);
}

function dijkstra(graph, src, dst) {
  var visited = {}, parents = {}, total;
  var priorityq = new PriorityQueue(function(pair_a, pair_b) {
    return pair_b[1] - pair_a[1];
  });

  priorityq.enq([src, 0, null]);
  while (!priorityq.isEmpty()) {
    var _u = priorityq.deq();
    var u = _u[0], d = _u[1], p = _u[2];

    if (visited[u]) continue;
    visited[u] = true;
    parents[u] = p;

    if (u == dst) {
      total = d;
      break;
    }

    // peeking u's neighbours
    for (var v in graph[u].neighbours) {
      if (!visited[v]) {
        var r = graph[u].neighbours[v];
        //TODO: take into account that you have to arrive before leaving
        //XXX: instead of the above, the cheapest is being chosen
        var p = (r.length > 1 ? r.reduce(function (a, c) { return a.min_price < c.min_price ? a : c; }) : r[0]).min_price;
        priorityq.enq([v, d + p.price + p.tax, u]);
      }
    }
  }

  var rpath = [];
  var vert = dst;
  while (vert != null) {
    rpath.push(vert);
    vert = parents[vert];
  }

  var path = rpath.slice().reverse();
  var route = [];
  var cur = rpath.pop();
  while (rpath.length > 0) {
    var next = rpath.pop();
    route.push([cur, next]);
    cur = next;
  }

  return {
    total: total,
    path: path,
    route: route
  }
}

window.dijkstra = dijkstra;
window.graph = airport_graph;

// vim: et sw=2 ts=2 sts=2