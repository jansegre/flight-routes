/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

function main() {
  var d3 = require('d3/d3');
  require('./lib/d3.geo.zoom');
  var topojson = require('topojson/topojson');
  var PriorityQueue = require('priorityqueuejs');
  var accounting = require('accounting');

  var projection = d3.geo.orthographic()
      .clipAngle(90)
      .rotate([53, 14, 0])
      .precision(0.5)

  var svg = d3.select("#map")
      .append("svg");

  var loader = d3.dispatch("world"), id = -1;
  loader.on("world." + (++id), function() { svg.selectAll("path").attr("d", path); });

  function adjustToScreen() {
    var width = 900,
        height = 560,
        scale = 800;

    if (window.innerWidth < 900) {
      width = height = window.innerWidth;
      if (window.innerHeight < height - 50) {
        height = window.innerHeight - 50;
      }
      scale = Math.min(width, height) * 1.5;
    }

    projection = projection
        .clipExtent([[1, 1], [width - 1, height - 1]])
        .scale(scale)
        .translate([width / 2, height / 2]);

    path = path
        .projection(projection);

    svg = svg
        .attr("width", width)
        .attr("height", height)
        .call(d3.geo.zoom().projection(projection)
          .scaleExtent([projection.scale() / 4, projection.scale() * 7])
          .on("zoom.redraw", function() {
            d3.event.sourceEvent.preventDefault();
            svg.selectAll("path").attr("d", path);
          }));

    loader.world();
  }

  var path = d3.geo.path()
      .projection(projection)
      .pointRadius(5);

  adjustToScreen();
  window.addEventListener("resize", adjustToScreen, false);
  window.adjust = adjustToScreen;


  var bg = svg.append("g").attr("class", "bg");
  var md = svg.append("g").attr("class", "md");
  var fg = svg.append("g").attr("class", "fg");

  function drawMap(ctx, path, mousePoint) {
    ctx.append("path")
        .datum(d3.geo.graticule())
        .attr("class", "graticule")
        .attr("d", path);

    ctx.append("path")
        .datum({type: "Sphere"})
        .attr("class", "foreground")
        .attr("d", path)
        .on("mousedown.grab", function() {
          var point;
          if (mousePoint) {
            point = ctx.insert("path", ".foreground")
              .datum({type: "Point", coordinates: projection.invert(d3.mouse(this))})
              .attr("class", "point")
              .attr("d", path);
          }
          svg.classed("zooming", true);
          var w = d3.select(window).on("mouseup.grab", function() {
                svg.classed("zooming", false);
                w.on("mouseup.grab", null);
                if (mousePoint) {
                    point.remove();
                }
              });
        });
  }

  bg.call(drawMap, path, true);

  function dijkstra(graph, src, dst) {
    var visited = {}, parents = {}, total;
    var priorityq = new PriorityQueue(function(pair_a, pair_b) {
      return pair_b[1] - pair_a[1];
    });

    priorityq.enq([src, 0, null]);
    while (!priorityq.isEmpty()) {
      var _u = priorityq.deq();
      var u = _u[0], d = _u[1], p = _u[2];

      if (visited[u]) {
        continue;
      }

      visited[u] = true;
      parents[u] = p;

      if (u === dst) {
        total = d;
        break;
      }

      // peeking u's neighbours
      for (var v in graph[u].neighbours) {
        if (!visited[v]) {
          var r = graph[u].neighbours[v];
          //TODO: take into account that you have to arrive before leaving
          //XXX: instead of the above, the cheapest is being chosen
          var pr = (r.length > 1 ? r.reduce(function (a, c) { return a.min_price < c.min_price ? a : c; }) : r[0]).min_price;
          priorityq.enq([v, d + pr.price + pr.tax, u]);
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
    };
  }

  d3.json("world-110m.json", function(error, world) {
    if (error) {
      //TODO: better error handling
      console.log("An error occurred: " + (error.msg || error));
      return;
    }
    bg.insert("path", ".foreground")
        .datum(topojson.feature(world, world.objects.land))
        .attr("class", "land");
    bg.insert("path", ".foreground")
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

    fg.selectAll("path.airport")
        .data(airports.map(function (a) {
          return { type: "Point", coordinates: a.coordinates, iata: a.iata, projection: projection };
        }))
        .enter()
        .append("path")
        .attr("class", "airport")
        .attr("id", function (d) { return d.iata; })
        .attr("d", projection)
        .on("click", function(d) {
          if (select_a) {
            airport_a = d;
            d3.selectAll(".has-to").classed("hidden", true);
            d3.selectAll(".has-from").classed("hidden", false);
            d3.select("#from-airport").html(airport_graph[d.iata].name);
            d3.select("#from-city").html(airport_graph[d.iata].city);
          } else {
            airport_b = d;
            var dijk = dijkstra(airport_graph, airport_a.iata, airport_b.iata);
            var lines = md.selectAll("path.line")
              .data(dijk.route.map(function(r) {
                var a = airport_graph[r[0]].coordinates;
                var b = airport_graph[r[1]].coordinates;
                return {type: "LineString", coordinates: [a, b], route: r.join("-")};
              }))
              .attr("d", path);
            lines.enter()
              .append("path")
              .attr("class", "line")
              .attr("id", function(d) { return d.route + "!"; })
              .attr("d", path)
              .on("click", function(d) {
                console.log(d);
              });
            lines.exit()
              .remove();
            d3.selectAll(".has-to").classed("hidden", false);
            d3.select("#to-airport").html(airport_graph[d.iata].name);
            d3.select("#to-city").html(airport_graph[d.iata].city);
            d3.select("#total").html(accounting.formatMoney(dijk.total, "R$ ", 2, ".", ","));
            var hasTotal = dijk.total != null;
            d3.selectAll(".has-total").classed("hidden", !hasTotal);
            d3.selectAll(".no-route").classed("hidden", hasTotal);
          }
          select_a = !select_a;
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

    var lines = [];
    for (var line in routes) {
      if (typeof routes[line] !== "string") {
        lines.push(line.split("-"));
      }
    }

    bg.selectAll("path.route")
      .data(lines.map(function(r) {
        var a = airport_graph[r[0]].coordinates;
        var b = airport_graph[r[1]].coordinates;
        return {type: "LineString", coordinates: [a, b], route: r.join("-")};
      }))
      .enter()
      .append("path")
      .attr("class", "route")
      .attr("id", function (d) { return d.route; })
      .attr("d", path);

    for (var route_name in routes) {
      var orig = route_name.split("-")[0];
      var dest = route_name.split("-")[1];
      var route = routes[route_name];

      if (typeof route !== "string") {
        for (var i = 0; i < route.length; i++) {
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
    }

    loader.world();
  });

  //XXX: these are for debugging
  window.dijkstra = dijkstra;
  window.graph = airport_graph;

}

if (window.cordova) {
  document.addEventListener("deviceready", main, false);
} else {
  window.addEventListener("load", main, false);
}

// vim: et sw=2 ts=2 sts=2
