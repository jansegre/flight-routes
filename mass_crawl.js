var fs = require('fs');
var db = require('./load_data').database;
var crawl = require('./crawl');

var routes = [];
var output_file = __dirname + '/tam_crawl.json';
var date = '2014-07-06';
var complete = false;
var pending = 0;

function tam_routes(callback, complete, limit) {
    var query = 'select r.* from routes as r join airports as a1 on r.source_airport_id = a1.id join airports as a2 on r.destination_airport_id = a2.id where a1.country="Brazil" and a2.country="Brazil" and r.airline="JJ"';
    if (limit) query += ' limit ' + limit;
    db.each(query, callback, complete);
}

// the crawling itself
function doCrawl(err, route, done) {
    // give it a time to breath
    var international = false;
    var rt = route.source_airport + '-' + route.destination_airport;
    console.log('firing crawl for ' + rt);
    crawl(route.source_airport, route.destination_airport, date, international, function(err, data) {
        if (err || !data) {
            console.log('error crawling for ' + rt + ': ' + err);
            pending--;
            return;
        }
        if (data.length != 0) {
            routes.push(data);
            console.log('finished crawl for ' + rt + ': ' + data.length + ' flights found');
        } else {
            console.log('finished crawl for ' + rt + ': no flights found');
        }
        done();
    });
}

// some job queueing to limit concurrent jobs
var queue = [];
function done() {
    pending--;
    if (complete && pending == 0) {
        console.log('finished crawling, saving...');
        var pretty = true;
        var out = pretty? JSON.stringify(routes, null, 2) : JSON.stringify(routes);
        fs.writeFile(output_file, out, function (err) {
            if (err) console.log('error (' + err + ') saving to ' + output_file);
            else console.log('saved successfully to ' + output_file + ', all done.');
        });
    }
}

tam_routes(function(err, route) {
    queue.push(function() { doCrawl(err, route, done); });
}, function(err, routes) {
    pending += routes;
    complete = true;
});

var interval = setInterval(function() {
    if (queue.length == 0) clearInterval(interval);
    else (queue.pop())();
}, 3000);
