var fs = require('fs');
var db = require('./load_data').database;
var crawl = require('./crawl');

var routes = {};
var output_file = __dirname + '/tam_crawl.json';
var date = '2014-07-06';

function airline_routes(airline, callback, complete, limit) {
    var query = 'select r.* from routes as r join airports as a1 on r.source_airport_id = a1.id join airports as a2 on r.destination_airport_id = a2.id where a1.country="Brazil" and a2.country="Brazil" and r.airline="' + airline + '"';
    if (limit) query += ' limit ' + limit;
    db.each(query, callback, complete);
}

// the crawling itself
function doCrawl(err, airline, route, done) {
    // give it a time to breath
    var international = false;
    var rt = route.source_airport + '-' + route.destination_airport;
    console.log('starting crawl for ' + rt);
    crawl(airline, route.source_airport, route.destination_airport, date, international, function(err, data) {
        if (err || !data) {
            console.log('error crawling for ' + rt + ': ' + err);
            return done()
        }
        if (data.length != 0) {
            routes[rt] = data;
            console.log('finished crawl for ' + rt + ': ' + data.length + ' flights found');
        } else {
            routes[rt] = 'no flights';
            console.log('finished crawl for ' + rt + ': no flights found');
        }
        done();
    });
}

// some job queueing to limit concurrent jobs
var queue = [];
var pending = 0;
var parallel = 0;
var max_parallel = 16;

function done() {
    pending--;
    parallel--;
    update();
    if (pending == 0) {
        console.log('finished crawling, saving...');
        var pretty = true;
        var out = pretty? JSON.stringify(routes, null, 2) : JSON.stringify(routes);
        fs.writeFile(output_file, out, function (err) {
            if (err) console.log('error (' + err + ') saving to ' + output_file);
            else console.log('saved successfully to ' + output_file + ', all done.');
        });
    }
}

function update() {
    if (queue.length == 0) {
        console.log('queue is over, ' + pending + ' pending jobs...');
    } else {
        if (parallel < max_parallel) {
            parallel++;
            (queue.shift())();
        }
    }
}

// start crawling
var airline = 'JJ';// JJ is TAM, other implementations pending
airline_routes(airline, function(err, route) {
    queue.push(function() { doCrawl(err, airline, route, done); });
}, function(err, routes) {
    pending = routes;
    for (var i = 0; i < max_parallel; i++)
        update();
});
