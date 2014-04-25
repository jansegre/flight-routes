var fs = require('fs');

function parseString(raw_string) {
    var match = raw_string.match(/"(.*)"/);
    return match ? match[1] : null;
}

/*
 * Specs:
 *
 * Airline ID   Unique OpenFlights identifier for this airline.
 * Name Name of the airline.
 * Alias    Alias of the airline. For example, All Nippon Airways is commonly known as "ANA".
 * IATA 2-letter IATA code, if available.
 * ICAO 3-letter ICAO code, if available.
 * Callsign Airline callsign.
 * Country  Country or territory where airline is incorporated.
 * Active   "Y" if the airline is or has until recently been operational, "N" if it is defunct. This field is not reliable: in particular, major airlines that stopped flying long ago, but have not had their IATA code reassigned (eg. Ansett/AN), will incorrectly show as "Y".
 */
function parseAirline(raw_entry) {
    var entry = raw_entry.split(',');
    var airline = {
        id: parseInt(entry[0]),
        name: parseString(entry[1]),
        alias: parseString(entry[2]),
        iata_code: parseString(entry[3]),
        icao_code: parseString(entry[4]),

}
