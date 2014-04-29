var fs = require('fs');
var db = require('./load_data').database;
var crawl = require('./crawl');

function airline_routes(airline, callback, complete, limit) {
    //var query = 'select r.* from routes as r join airports as a1 on r.source_airport_id = a1.id join airports as a2 on r.destination_airport_id = a2.id where a1.country="Brazil" and a2.country="Brazil" and r.airline="' + airline + '"';
    var query = 'select r.*, a1.country as source_country, a2.country as destination_country from routes as r join airports as a1 on r.source_airport_id = a1.id join airports as a2 on r.destination_airport_id = a2.id where r.airline="' + airline + '"';
    if (limit) query += ' limit ' + limit;
    db.each(query, callback, complete);
}

// the crawling itself
function singleCrawl(err, airline, date, route, routes, done) {
    var international = route.source_country != 'Brazil' || route.destination_country != 'Brazil';
    var rt = route.source_airport + '-' + route.destination_airport;
    console.log('>> starting crawl for ' + rt + ' ' + date + '...');
    crawl(airline, route.source_airport, route.destination_airport, date, international, function(err, data) {
        if (err || !data) {
            console.log('!! error crawling for ' + rt + ' ' + date + ': ' + err + '.');
            return done();
        }
        if (data.length != 0) {
            routes[rt] = data;
            console.log('<< finished crawl for ' + rt + ' ' + date + ': ' + data.length + ' flights found.');
        } else {
            routes[rt] = 'no flights';
            console.log('<< finished crawl for ' + rt + ' ' + date + ': no flights found.');
        }
        done();
    }, function(retries) {
        console.log('.. retry attempt ' + retries + ' for ' + rt + ' ' + date + '...');
    });
}

// some job queueing to limit concurrent jobs
var queue = [];
var parallel = 0;
var max_parallel = 16;
var started = false;

function update() {
    if (queue.length == 0) {
        //console.log('queue is over.');
    } else {
        if (parallel < max_parallel) {
            parallel++;
            (queue.shift())();
        }
    }
}

function start() {
    if (!started) {
        started = true;
        for (var i = 0; i < max_parallel; i++)
            update();
    }
}

// complete crawl for a given date
function fullCrawl(date, next) {
    var airline = 'JJ'; // JJ is TAM, other implementations pending
    var output_file = __dirname + '/tam_' + date + '.json';
    var pending; // local number of pending jobs to finish a full crawling
    var routes = {};
    function done() {
        pending--;
        parallel--;
        update();
        if (pending == 0) {
            console.log('-- finished crawling of ' + date + ', saving...');
            var pretty = true;
            var out = pretty? JSON.stringify(routes, null, 2) : JSON.stringify(routes);
            fs.writeFile(output_file, out, function (err) {
                if (err) console.log('-- error (' + err + ') saving to ' + output_file);
                else console.log('-- saved successfully to ' + output_file + ', all done.');
            });
        }
    }
    airline_routes(
        airline,
        function(err, route) {
            queue.push(function() { singleCrawl(err, airline, date, route, routes, done); });
        },
        function(err, routes) {
            pending = routes;
            if (next) next();
            console.log('++ enqueued crawling of ' + date + '.');
            start();
        }
    );
}

(function() {
    var moment = require('moment');
    var date = moment('2014-05-17');
    var count = 180;
    (function recurse() {
        fullCrawl(date.format('YYYY-MM-DD'), function() {
            if (count > 0) {
                count--;
                date.add('days', 1);
                recurse();
            }
        });
    })();
})();
