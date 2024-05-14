let currentMap = null; // Declare a global variable to store the current map instance

$(document).ready(function() {
    $('#submit-btn').click(function() {
        var zipCode = $('#zip-code').val();
        displayMap(zipCode);
    });
});

function displayMap(zipCode) {
    // Load the CSV files
    Promise.all([
        $.get('existing_charging_stations.csv'),
        $.get('Alt_Fuel_PaloAlto_All_Existing.csv'),
        $.get('new_charging_stations.csv'),
        $.get('charging_points_forecast.csv')
    ]).then(function(results) {
        var existingStations = parseCSV(results[0]);
        var altFuelStations = parseCSV(results[1]);
        var newStations = parseCSV(results[2]);
        var chargingPointsForecast = parseCSV(results[3]);

        // Filter the data based on the user-input zip code
        var existingStationsFiltered = existingStations.filter(function(row) {
            return row.ZipCode == zipCode;
        });
        var altFuelStationsFiltered = altFuelStations.filter(function(row) {
            return row.ZIP == zipCode;
        });
        var newStationsFiltered = newStations.filter(function(row) {
            return row['Zip Code'] == zipCode;
        });

        // Create a map centered on the mean latitude and longitude of the filtered existing stations or new stations
        var mapCenter;
        if (existingStationsFiltered.length > 0) {
            mapCenter = [
                existingStationsFiltered.reduce(function(sum, row) { return sum + parseFloat(row.Latitude); }, 0) / existingStationsFiltered.length,
                existingStationsFiltered.reduce(function(sum, row) { return sum + parseFloat(row.Longitude); }, 0) / existingStationsFiltered.length
            ];
        } else if (altFuelStationsFiltered.length > 0) {
            mapCenter = [
                altFuelStationsFiltered.reduce(function(sum, row) { return sum + parseFloat(row.Latitude); }, 0) / altFuelStationsFiltered.length,
                altFuelStationsFiltered.reduce(function(sum, row) { return sum + parseFloat(row.Longitude); }, 0) / altFuelStationsFiltered.length
            ];
        } else if (newStationsFiltered.length > 0) {
            mapCenter = [
                newStationsFiltered.reduce(function(sum, row) { return sum + parseFloat(row.Latitude); }, 0) / newStationsFiltered.length,
                newStationsFiltered.reduce(function(sum, row) { return sum + parseFloat(row.Longitude); }, 0) / newStationsFiltered.length
            ];
        } else {
            // Set a default map center if no existing or new stations are found for the zip code
            mapCenter = [37.7749, -122.4194]; // Example: San Francisco coordinates
        }

        // Remove the existing map instance if it exists
        if (currentMap !== null) {
            currentMap.remove();
        }

        // Create a new map instance
        var map = L.map('map').setView(mapCenter, 12);
        currentMap = map; // Store the new map instance

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Create a legend control
        var legend = L.control({ position: 'bottomright' });

        legend.onAdd = function(map) {
            var div = L.DomUtil.create('div', 'legend');
            div.innerHTML += '<div><img src="https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png" style="width: 16px; height: 26px; vertical-align: middle;"> Existing Charging Station</div>';
            div.innerHTML += '<div><img src="https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" style="width: 16px; height: 26px; vertical-align: middle;"> New Charging Station</div>';
            return div;
        };

        legend.addTo(map);
        
        // Plot the filtered existing charging stations on the map
        existingStationsFiltered.forEach(function(row) {
            var forecastRow = chargingPointsForecast.find(function(forecastRow) {
                return forecastRow['Zip Code'] == row.ZipCode && forecastRow['Charging Station'] == row['Charging Station'];
            });

            var popupText = '<div style="width: 300px;"><strong>Existing Station:</strong> ' + row['Charging Station'] + '<br>' +
                            '<strong>Zip Code:</strong> ' + row.ZipCode + '<br>';
            if (forecastRow) {
                popupText += '<strong>Existing Charging Points:</strong> ' + forecastRow['Existing Charging Points'] + '<br>' +
                             '<strong>Predicted Charging Points 2024:</strong> ' + forecastRow['Predicted Charging Points 2024'] + '<br>' +
                             '<strong>Predicted Charging Points 2025:</strong> ' + forecastRow['Predicted Charging Points 2025'] + '<br>' +
                             '<strong>EV Charging Port Type:</strong>' + 'Level 2 Charger' + '<br>' +
                             '<strong>EV Charging Connector Type:</strong>' + 'J1772';
            }
            popupText += '</div>';

            L.marker([row.Latitude, row.Longitude], {
                icon: L.icon({
                    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map).bindPopup(popupText);
        });

        // Plot the filtered Alt Fuel stations on the map
        altFuelStationsFiltered.forEach(function(row) {
            var popupText = '<div style="width: 300px;"><strong>Station Name:</strong> ' + row['Station Name'] + '<br>' +
                            '<strong>Street Address:</strong> ' + row['Street Address'] + '<br>' +
                            '<strong>Zip Code:</strong> ' + row.ZIP + '<br>' +
                            '<strong>Facility Type:</strong> ' + row['Facility Type'] + '<br>' +
                            '<strong>EV Connector Types:</strong> ' + row['EV Connector Types'] + '<br>' +
                            '<strong>EV Level2 EVSE Num:</strong> ' + row['EV Level2 EVSE Num'] + '</div>';

            L.marker([row.Latitude, row.Longitude], {
                icon: L.icon({
                    iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map).bindPopup(popupText);
        });

        // Plot the filtered new charging stations on the map
        newStationsFiltered.forEach(function(row) {
            var lat = row.Latitude;
            var lon = row.Longitude;
            var zipCode = row['Zip Code'];

            // Retrieve the address using OpenStreetMap Nominatim API
            var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + lat + '&lon=' + lon;

            fetch(url)
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    var address = data.display_name;

                    var popupText = '<div style="width: 300px;"><strong>New Station:</strong><br>' +
                                    '<strong>Address:</strong> ' + address + '<br>' +
                                    '<strong>Zip Code:</strong> ' + zipCode + '<br>' +
                                    '<strong>Latitude:</strong> ' + lat + '<br>' +
                                    '<strong>Longitude:</strong> ' + lon + '</div>' + '<br>' +
                                    '<strong>EV Charging Port Type:</strong>' + 'Level 2 Charger' + '<br>' +
                                    '<strong>EV Charging Connector Type:</strong>' + 'J1772';

                    L.marker([lat, lon], {
                        icon: L.icon({
                            iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    }).addTo(map).bindPopup(popupText);
                })
                .catch(function(error) {
                    console.log('Error retrieving address:', error);
                });
        });
    });
}

function parseCSV(csv) {
    var lines = csv.split('\n');
    var headers = lines[0].split(',');
    var data = [];

    for (var i = 1; i < lines.length; i++) {
        var values = lines[i].split(',');
        if (values.length === headers.length) {
            var row = {};
            for (var j = 0; j < headers.length; j++) {
                row[headers[j]] = values[j];
            }
            data.push(row);
        }
    }

    return data;
}
