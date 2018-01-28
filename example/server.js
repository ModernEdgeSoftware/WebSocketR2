const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', function connection(ws) {
    //Send a random message to the client
    ws.send(JSON.stringify({data:"Hello Client"}));

    ws.on('message', function onMessage(message) {
        console.log(message);

        var request = JSON.parse(message);

        //Check if callback is needed
        if(request.id != undefined){
            var response = {
                id: request.id,
                data: {
                    accountId: 1234
                }
            };
            ws.send(JSON.stringify(response));
        }
    });
});