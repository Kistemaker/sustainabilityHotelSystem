var grpc = require("@grpc/grpc-js")
var protoLoader = require("@grpc/proto-loader")

var ENERGY_SERVICE_PROTO_PATH = __dirname + "/protos/EnergyService.proto"
var energyServicePackageDefinition = protoLoader.loadSync(ENERGY_SERVICE_PROTO_PATH)
var energyService_proto = grpc.loadPackageDefinition(energyServicePackageDefinition).EnergyService
var energyServiceClient = new energyService_proto("0.0.0.0:40000", grpc.credentials.createInsecure());

var ROOM_TEMP_PROTO_PATH = __dirname + "/protos/RoomTemperatureUpdateService.proto"
var roomTempPackageDefinition = protoLoader.loadSync(ROOM_TEMP_PROTO_PATH)
var roomTemperatureUpdateService_proto = grpc.loadPackageDefinition(roomTempPackageDefinition).RoomTemperatureUpdateService

var locationid = Math.ceil(Math.random() * 100)
var powerconsumption = 60

var port = 50000 + locationid;


try {
    var call = energyServiceClient.get(function(error, response) {
        if (error) {
            console.log('an error  occured ' + error)
        }
        console.log('received response result ' + response.result + ' with message: ' + response.message)
    })
    setInterval(() => sendConsumption(call), 1000);
} catch(e) {
    console.log("an  error occurred " + e)
}

function sendConsumption(call) {
    var timestamp = Date.now()
    console.log('sending reading ' + powerconsumption + ' from room ' + locationid + ' at ' + new Date(timestamp).toLocaleString());
    call.write({locationid: locationid, powerconsumption: powerconsumption, timestamp: timestamp / 1000})
}

function updateTemperature(call, callback) {
    if (call.request.roomtemperature < 10) {
        callback(null, {success: 0, message: "too cold!"});
        return;
    }
    powerconsumption = call.request.roomtemperature;
    callback(null, {success: 1, message: "updated temperature, thank you!"});
}

var server = new grpc.Server()
server.addService(roomTemperatureUpdateService_proto.service, {
    updateTemperature: updateTemperature,
})

server.bindAsync("0.0.0.0:" + port, grpc.ServerCredentials.createInsecure(), function() {
    console.log('starting server')
    server.start()
})