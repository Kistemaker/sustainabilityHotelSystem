var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")
var ENERGY_SERVICE_PROTO_PATH = __dirname + "/protos/EnergyService.proto"
var ROOM_TEMP_PROTO_PATH = __dirname + "/protos/RoomTemperatureUpdateService.proto"
var energyServicePackageDefinition = protoLoader.loadSync(ENERGY_SERVICE_PROTO_PATH)
var roomTemperaturePackageDefinition = protoLoader.loadSync(ROOM_TEMP_PROTO_PATH)
var energyService_proto = grpc.loadPackageDefinition(energyServicePackageDefinition).EnergyService
var roomTemperatureUpdateService_proto = grpc.loadPackageDefinition(roomTemperaturePackageDefinition).RoomTemperatureUpdateService

const express = require('express');
const fs = require('fs')
const readFile = fs.readFile

var readings = []

function get(call, callback) {
    try {
        call.on('data', function(data) {

            var locationid = data.locationid
            var powerconsumption = data.powerconsumption
            var timestamp = new Date(data.timestamp * 1000).toLocaleString()
            console.log('received reading ' + powerconsumption + ' from room ' + locationid + ' at ' + timestamp)

            readings.push(data)
          });
          call.on('end', function() {
            
            callback(null, {
                message: 'received reading, thank you',
                result: 1
            })
          });
    } catch(e) {
        callback(null, {
            result: 0,
            message: "An error occurred!" + e
        })
    }
}

var server = new grpc.Server()
server.addService(energyService_proto.service, {
    get: get,
})

server.bindAsync("0.0.0.0:40000", grpc.ServerCredentials.createInsecure(), function() {
    console.log('starting server')
    server.start()
})

const app = express();
app.use(express.urlencoded());

app.get('/', (request, response) => {
    var html = '<div style="float: left; padding: 25px;"><h2>Latest power readings</h2><table style="border: 1px solid black;border-collapse:collapse;"><tr><th style="padding: 10px; border-right: 1px solid black; border-left: 1px solid black">Timestamp</th><th style="padding: 10px; border-right: 1px solid black; border-left: 1px solid black">Room</th><th style="padding: 10px; border-right: 1px solid black; border-left: 1px solid black">power consumption</th></tr>';
    readings.forEach(reading => {
        html += '<tr><td style="padding: 10px; border-right: 1px solid black; border-left: 1px solid black">' + new Date(reading.timestamp * 1000).toLocaleTimeString() + '</td><td style="padding: 10px; border-right: 1px solid black; border-left: 1px solid black">' + reading.locationid + '</td><td style="padding: 10px; border-right: 1px solid black; border-left: 1px solid black">' + reading.powerconsumption + '</td></tr>';
    })

    html += '</table></div><form method="post" style="float: left; padding: 25px"><h2>Change room temperature</h2><input type="number" placeholder="temperature" name="temperature" /><br><select name="locationid">'

    rooms = new Set()
    readings.forEach(reading => {
        rooms.add(reading.locationid)
    })

    Array.from(rooms).forEach(room => {
        html += '<option value=' + room + '>Room ' + room + "</option>"
    })

    html += '</select><br><input type="submit"></form>'

    response.send(html);
});

app.post('/', (request, response) => {
    var locationid = request.body.locationid;
    var temperature = request.body.temperature;
    var port = 50000 + parseInt(locationid, 10)
    console.log("0.0.0.0:" + port);
    var roomClient = new roomTemperatureUpdateService_proto("0.0.0.0:" + port, grpc.credentials.createInsecure());
    
    roomClient.updateTemperature({locationid: locationid, roomtemperature: parseInt(temperature, 10), duration: 3000}, function (error, grpcresponse) {
        
        response.set('Content-Type', 'text/html');
        if (error) {
            response.end('An error occurred ' + grpcresponse);
        }
        else if (grpcresponse.success == 0) {
            response.end('An error occurred ' + grpcresponse.message);
        } else {
            response.end('Done! <a href="/">Go back</a>');
        }
    });
})




app.listen(process.env.PORT || 3000, () => console.log('App available on http://localhost:3000'))