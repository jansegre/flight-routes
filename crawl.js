var request = require('request');
var moment = require('moment');
var jsdom = require('jsdom');
var userAgent = 'jansegre-crawler/0.0.1';

// The following is known to work:
//     curl -v 'http://book.tam.com.br/TAM/dyn/air/booking/upslDispatcher' --data 'SITE=JJBKJJBK&LANGUAGE=BR&WDS_MARKET=BR&B_DATE_1=201407060000&B_LOCATION_1=CWB&E_LOCATION_1=BSB&TRIP_TYPE=O&adults=1&COMMERCIAL_FARE_FAMILY_1=NEWBUNDLE'
//

// example: postData('SDU', 'BSB', new Date(2014, 6, 6))
function postData(from_airport, to_airport, date, international) {
  var inter = (international == null) ? false : international;
  var d = moment(date);
  return {
    'SITE': 'JJBKJJBK',
    'LANGUAGE': 'BR',
    'WDS_MARKET': 'BR',
    // format: '201407060000'
    'B_DATE_1': d.format('YYYYMMDDHHmm'),
    'B_LOCATION_1': from_airport,
    'E_LOCATION_1': to_airport,
    'TRIP_TYPE': 'O',
    'adults': '1',
    'COMMERCIAL_FARE_FAMILY_1': (inter ? 'JJINTECO' : 'NEWBUNDLE')
  };
}

var postUrl = 'http://book.tam.com.br/TAM/dyn/air/booking/upslDispatcher';

function getBody(from_airport, to_airport, date, inter, callback) {
  request.post(postUrl, {
    form: postData(from_airport, to_airport, date, inter),
    headers: { 'User-Agent': userAgent }
  }, callback);
}

function crawlPage(page, callback, retry) {
  var result = [];
  if (page == '') retry();
  else jsdom.env({
    html: page,
    done: function(err, w) {
      if (err) return callback(err, null);
      var flights = w.document.querySelectorAll('.list_flight_direct .flight');
      for (var i = 0, len = flights.length; i < len; i++) {
        var e = flights[i], data = {};
        data.aircraft = e.getAttribute('data-aircraft');
        data.departure = new Date(e.getAttribute('data-departuredate'));
        data.arrival = new Date(e.getAttribute('data-arrivaldate'));
        data.flightnumber = e.getAttribute('data-flightnumber');
        data.source_airport = e.getAttribute('data-departureairportcode');
        data.destination_airport = e.getAttribute('data-arrivalairportcode');
        data.prices = [];
        var ff = e.querySelectorAll('.ff');
        for (var j = 0, jlen = ff.length; j < jlen; j++) {
          var f = ff[j];
          var fare = {
              plan: f.getAttribute('data-cell-fare-family'),
              price: parseFloat(f.getAttribute('data-cell-price-adt')),
              tax: parseFloat(f.getAttribute('data-cell-tax-adt')),
          }
          var ls = f.getAttribute('data-cell-lastseats');
          if (ls) fare.lastseats = parseInt(ls);
          // only push if available (price not null)
          if (fare.price) data.prices.push(fare);
        }
        result.push(data);
      }
      //done
      callback(null, result);
    }
  });
}

//example: crawl('BSB', 'SDU', '2014-07-06', false, function (data) {console.log(data)})
function crawl(from_airport, to_airport, date, inter, callback) {
  var run = true, retries = 0, maxretries = 5;
  var retry = function() {
    if (retries < maxretries) {
      run = true;
      retries++;
      return true;
    } else {
      return false;
    }
  }
  while (run) {
    run = false;
    getBody(from_airport, to_airport, date, inter, function (err, res, page) {
      if (!err && res.statusCode == 200) crawlPage(page, callback, retry);
      else if (!retry()) callback(err, null);
    });
  }
}

module.exports = crawl;
if (require.main == module) {
  var argv = process.argv;
  if (argv.length != 5) {
    console.log('usage: node crawl.js <src> <dst> <date>');
  } else {
    // argv[0] is 'node' and argv[1] is ~'./crawl.js'
    crawl(argv[2], argv[3], argv[4], false, function (err, data) {
    //getBody(argv[2], argv[3], argv[4], false, function (err, res, data) {
      if (err) {
        console.log(err);
      } else {
        console.log(JSON.stringify(data, null, 2));
        //console.log(data);
      }
    });
  }
}

// vim: et sw=2 ts=2 sts=2
