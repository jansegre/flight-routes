/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var fs = require('fs');
var sqlite3 = require('sqlite3');
var db = new sqlite3.Database(':memory:');

// helper functions
function parseString(raw_string) {
  if (raw_string === '') return '';
  var m = raw_string.match(/^\\N$/);
  if (m) return null;
  m = raw_string.match(/"(.*)"/);
  if (m) return m[1];
  return raw_string;
}
function parseNullableInt(raw_string) {
  var m = raw_string.match(/^\\N$/);
  if (m) return null;
  return parseInt(raw_string);
}
function parseBool(raw_string) {
  var s = parseString(raw_string);
  switch (s) {
  case 'Y': return true;
  case 'N': return false;
  default: return null;
  }
}

/*
 * Specs:
 *
 * Airline ID   Unique OpenFlights identifier for this airline.
 * Name         Name of the airline.
 * Alias        Alias of the airline. For example, All Nippon Airways is commonly known as "ANA".
 * IATA         2-letter IATA code, if available.
 * ICAO         3-letter ICAO code, if available.
 * Callsign     Airline callsign.
 * Country      Country or territory where airline is incorporated.
 * Active       "Y" if the airline is or has until recently been operational, "N" if it is defunct. This field is not reliable: in particular, major airlines that stopped flying long ago, but have not had their IATA code reassigned (eg. Ansett/AN), will incorrectly show as "Y".
 */
function parseAirline(raw_entry) {
  var entry = raw_entry.replace(/\r/g, '').split(',');
  return {
    id: parseInt(entry[0]),
    name: parseString(entry[1]),
    alias: parseString(entry[2]),
    iata: parseString(entry[3]),
    icao: parseString(entry[4]),
    callsign: parseString(entry[5]),
    country: parseString(entry[6]),
    active: parseBool(entry[7])
  };
}

/*
 * Specs:
 *
 * Airport ID   Unique OpenFlights identifier for this airport.
 * Name         Name of airport. May or may not contain the City name.
 * City         Main city served by airport. May be spelled differently from Name.
 * Country      Country or territory where airport is located.
 * IATA/FAA     3-letter FAA code, for airports located in Country "United States of America".
 *              3-letter IATA code, for all other airports.
 *              Blank if not assigned.
 * ICAO         4-letter ICAO code.
 *              Blank if not assigned.
 * Latitude     Decimal degrees, usually to six significant digits. Negative is South, positive is North.
 * Longitude    Decimal degrees, usually to six significant digits. Negative is West, positive is East.
 * Altitude     In feet.
 * Timezone     Hours offset from UTC. Fractional hours are expressed as decimals, eg. India is 5.5.
 * DST          Daylight savings time. One of E (Europe), A (US/Canada), S (South America), O (Australia), Z (New Zealand), N (None) or U (Unknown). See also: Help: Time
 */
function parseAirport(raw_entry) {
  var entry = raw_entry.replace(/\r/g, '').split(',');
  return {
    id: parseInt(entry[0]),
    name: parseString(entry[1]),
    city: parseString(entry[2]),
    country: parseString(entry[3]),
    iata: parseString(entry[4]),
    icao: parseString(entry[5]),
    latitude: parseFloat(entry[6]),
    longitude: parseFloat(entry[7]),
    altitude: parseFloat(entry[8]),
    timezone: parseFloat(entry[9]),
    dst: parseString(entry[10])
  };
}

/*
 * Specs:
 *
 * Airline                2-letter (IATA) or 3-letter (ICAO) code of the airline.
 * Airline ID             Unique OpenFlights identifier for airline (see Airline).
 * Source airport         3-letter (IATA) or 4-letter (ICAO) code of the source airport.
 * Source airport ID      Unique OpenFlights identifier for source airport (see Airport)
 * Destination airport    3-letter (IATA) or 4-letter (ICAO) code of the destination airport.
 * Destination airport ID Unique OpenFlights identifier for destination airport (see Airport)
 * Codeshare              "Y" if this flight is a codeshare (that is, not operated by Airline, but another carrier), empty otherwise.
 * Stops                  Number of stops on this flight ("0" for direct)
 * Equipment              3-letter codes for plane type(s) generally used on this flight, separated by spaces
 */
function parseRoute(raw_entry) {
  var entry = raw_entry.replace(/\r/g, '').split(',');
  return {
    airline: parseString(entry[0]),
    airline_id: parseNullableInt(entry[1]),
    source_airport: parseString(entry[2]),
    source_airport_id: parseNullableInt(entry[3]),
    destination_airport: parseString(entry[4]),
    destination_airport_id: parseNullableInt(entry[5]),
    codeshare: parseString(entry[6]),
    stops: parseInt(entry[7]),
    equipment: parseString(entry[8])
  };
}

// loaders
function loadAirlines(file) {
  var p, i, d = fs.readFileSync(file).toString().split('\n');
  var stmt = db.prepare('insert into airlines values (?, ?, ?, ?, ?, ?, ?, ?)');
  for (i = 0; i < d.length - 1; i++) {
    p = parseAirline(d[i]);
    stmt.run(p.id, p.name, p.alias, p.iata, p.icao, p.callsign, p.country, p.active);
  }
  stmt.finalize();
}
function loadAirports(file) {
  var p, i, d = fs.readFileSync(file).toString().split('\n');
  var stmt = db.prepare('insert into airports values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (i = 0; i < d.length - 1; i++) {
    p = parseAirport(d[i]);
    stmt.run(p.id, p.name, p.city, p.country, p.iata, p.icao, p.latitude, p.longitude, p.altitude, p.timezone, p.dst);
  }
  stmt.finalize();
}
function loadRoutes(file) {
  var p, i, d = fs.readFileSync(file).toString().split('\n');
  var stmt = db.prepare('insert into routes values (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (i = 0; i < d.length - 1; i++) {
    p = parseRoute(d[i]);
    stmt.run(p.airline, p.airline_id, p.source_airport, p.source_airport_id, p.destination_airport, p.destination_airport_id, p.codeshare, p.stops, p.equipment);
  }
  stmt.finalize();
}

// default
function initialLoad() {
  db.serialize(function() {
    db.run('create table if not exists airlines (id integer primary key, name text, alias text, iata text, icao text, callsign text, country text, active boolean)');
    db.run('create table if not exists airports (id integer primary key, name text, city text, country text, iata text, icao text, latitude real, longitude real, altitude real, timezone real, dst text)');
    db.run('create table if not exists routes (airline text, airline_id integer, source_airport text, source_airport_id integer, destination_airport text, destination_airport_id integer, codeshare text, stops integer, equipment text)');
    loadAirlines(__dirname + '/airlines.dat'),
    loadAirports(__dirname + '/airports.dat'),
    loadRoutes(__dirname + '/routes.dat')
  });
}
// load on require:
initialLoad();

// api
exports.database = db;

// vim: et sw=2 ts=2 sts=2
