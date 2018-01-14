# WebSocketR2 <img align="right" src="images/R2.png"/>
A Request Response (R2) wrapper for websockets in the browser. 


## Features
**Callbacks:** Send messages with callbacks. This brings ajax like functionality to websockets.

**Message Timeouts:** After a configurable amount of time WebSocketR2 will resend the message. 

**Auto Reconnect:** If the connection is lost WebSocketR2 will try to re-establish the connection for you. This is why there is a reopened event. This is helpful if your servers are behind a load balancer and the server you were connected to went down. 

```JavaScript
var ws = new WebSocketR2("ws://localhost:3000");
        
ws.onopen(function(){
    console.log("WebSocket Open!");
    
    ws.send("A message without a callback.");
    sendMessageWithCallback();
});

ws.onmessage(function(message){
    console.log(message);
});

ws.onclose(function(){
    console.log("WebSocket Closed!");
});

ws.onreopen(function(){
    console.log("WebSocket Reopened!");
});

function sendMessageWithCallback(){
    var request = {
        action: "login",
        params: {
            username: "test",
            password: "password"
        }
    };

    ws.send(request, function(response){
        console.log(response)
    });
}
```

## How it works
WebSocketR2 contains an sequence variable for IDs, similar to a sequence in a database. Each message is packaged up into JSON and sent with an ID. The format looks like this: 
```JavaScript
{ id:1, data:"Your data. This can be a simple message or a JSON object."}
```
A request with an ID signals to the websocket server that the client would like a response. The server needs to send the response back in the same format, with the same ID. When WebSocketR2 gets a response it looks up the ID in an array and calls the corresponding callback function. That's basically it!

## Configuration
All values have defaults and are optional. Defaults are shown below.
```JavaScript
var params = {
  autoReconnect: true                 //Enable/Disable reconnect when the server closes connection (boolean)
  autoReconnectInterval: 1000         //Milliseconds to wait between reconnect attempts (number)
  requestTimeout: 30000               //Milliseconds to wait for a response before resending the request (number)
  requestRetryInterval: 5000          //Milliseconds between request retry checks. This garbage collects the retry queue (number)
  requestRetryQueueMaxLength: 1000    //Max queue length of retry queue before old messages start getting dropped (number)
}

var ws = new WebSocketR2("ws://localhost:3000", params);
```

## Why?
Because websockets are extremely fast and unlike UDP they are supported in the browser. They just lack some basic structure to make them more useful.
