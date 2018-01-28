/**
 * 
 * @param {*} url 
 * @param {*} params 
 * 
 * Possible Param Values:
 * 
 * params.autoReconnect                 (Default: true)  This will try to reconnect when the server closes connection
 * params.autoReconnectInterval         (Default: 1000)  This will try the reconnect every second
 * params.autoReconnectMaxRetries       (Default: 600)   This will try to reconnect for up to 10 minutes
 * params.requestTimeout                (Default: 30000) This will resend a request after 30 seconds
 * params.requestRetryInterval          (Default: 5000)  This will scan the retry queue every 5 seconds for any timed out requests
 * params.requestRetryQueueMaxLength    (Default: 1000)  This will only allow the retry queue to grow to 1000 items in length
 */
function WebSocketR2(url, params) {
    //Private scoped vars
    var ws = undefined;
    var requestIDs = {};
    var retryQueue = [];
    var retryCount = 0;
    var sequence = 0;
    var initialConnectionEstablished = false;
    var connected = false;
    var onOpenCallback = undefined;
    var onMessageCallback = undefined;
    var onCloseCallback = undefined;
    var onReOpenCallback = undefined;

    //Initialize defaults
    if(params == undefined || params == null){
        params = {};
    }

    if(params.autoReconnect == undefined || params.autoReconnect == null){
        params.autoReconnect = true;
    }

    if(params.autoReconnectInterval == undefined || params.autoReconnectInterval == null){
        params.autoReconnectInterval = 1000;
    }

    if(params.autoReconnectMaxRetries == undefined || params.autoReconnectMaxRetries == null){
        params.autoReconnectMaxRetries = 600;
    }

    if(params.requestTimeout == undefined || params.requestTimeout == null){
        params.requestTimeout = 1000 * 30;
    }

    if(params.requestRetryInterval == undefined || params.requestRetryInterval == null){
        params.requestRetryInterval = 1000 * 5;
    }

    if(params.requestRetryInterval < params.requestTimeout){
        params.requestRetryInterval = params.requestTimeout;
    }

    if(params.requestRetryQueueMaxLength == undefined || params.requestRetryQueueMaxLength == null){
        params.requestRetryQueueMaxLength = 1000;
    }

    //Setup public event listener methods
    this.onopen = function(callback){
        onOpenCallback = callback;
    };

    this.onmessage = function(callback){
        onMessageCallback = callback;
    };

    this.onclose = function(callback){
        onCloseCallback = callback;
    };

    this.onreopen = function(callback){
        onReOpenCallback = callback;
    };

    //Setup public action methods
    this.send = function(data, callback){
        var request = {};
        request.data = data;

        if(callback != undefined && callback != null){
            request.id = sequence;

            //Save off the callback function
            requestIDs[sequence] = callback;

            //Add new request to queue so we can keep track of it incase we need to resend
            retryQueue.push({
                request: request,
                timestamp: new Date().getTime()
            });

            //Keep the queue within specified limit
            if(retryQueue.length > params.requestRetryQueueMaxLength){
                retryQueue.shift();
            }

            //Make sure we don't exceed that max int in javascript
            if(sequence < Number.MAX_SAFE_INTEGER){ sequence++; }
            else{ sequence = 0; }
        }

        ws.send(JSON.stringify(request));
    };

    //Register listeners each time a new ws connection is made without requiring new callbacks or objects to be initialized
    function registerListeners(){
        ws.onopen = function(){
            processOnOpen();
        }

        ws.onmessage = function(e){
            processOnMessage(e);
        }

        ws.onclose = function(){
            processOnClose();
        }
    }

    //Event handlers
    function processOnOpen(){
        connected = true;
        retryCount = 0;

        if(!initialConnectionEstablished){
            if(onOpenCallback != undefined){
                onOpenCallback();
            }

            initialConnectionEstablished = true;
        }else{
            if(onReOpenCallback != undefined){
                onReOpenCallback();
            }
        }
    }

    function processOnMessage(e){
        var response = {};

        try{
            var json = JSON.parse(e.data);
            try{
                response.id = json.id;
                response.data = json.data;

                if(response.id != undefined){
                    if(isNumeric(response.id)){
                        requestIDs[response.id](response);
                        delete requestIDs[response.id];
                    }else{
                        console.error("ID from server is not a number. "+JSON.stringify(response));
                    }
                }else{
                    if(onMessageCallback != undefined){
                        onMessageCallback(response); 
                    }
                }
            }catch(ex){
                console.error(ex);
            }
        }catch(ex){
            console.warn("Response from server is not json.");
            if(onMessageCallback != undefined){
                onMessageCallback(e.data); 
            }
        }
    }

    function processOnClose(){
        if(connected){
            connected = false;
            if(onCloseCallback != undefined){
                onCloseCallback();
            }

            if(params.autoReconnect){
                reconnect();
            }
        }
    }

    function processOnReOpen(){
        onReOpenCallback();
    }

    //Timer based functions
    function reconnect(){
        if(!connected && ws.readyState == WebSocket.CLOSED){
            retryCount++;
            ws = new WebSocket(url);
            registerListeners();
        }
    }

    if(params.autoReconnect){
        var retryInterval = setInterval(function(){
            if(retryCount < params.autoReconnectMaxRetries){
                reconnect();   
            }else{
                clearInterval(retryInterval);
                console.info("Max retries exceeded. Re-connection attempts will no longer be made.");
            }
        }, params.autoReconnectInterval);
    }

    if(params.requestTimeout > 0){
        checkForRetries();
    }

    function checkForRetries(){
        if(retryQueue.length > 0){
            var shiftCount = 0;
            var initialLength = retryQueue.length;
            var now = new Date().getTime();
            for(var i=0; i<initialLength; i++){
                if(i >= (initialLength - shiftCount)){
                    break;
                }else if(now - retryQueue[i].timestamp > params.requestTimeout){
                    if(requestIDs[retryQueue[i].request.id] == undefined){ 
                        console.debug("Callback already received. Removing id = "+retryQueue[i].request.id);
                        retryQueue.shift();

                        i--;
                        shiftCount++;
                    }else{
                        console.debug("params.requestTimeout detected. Resending id = "+retryQueue[i].request.id);
                        ws.send(JSON.stringify(retryQueue[i].request));

                        retryQueue[i].timestamp = now;
                        retryQueue.push(retryQueue.shift());

                        i--;
                        shiftCount++;
                    }
                }else{
                    break;
                }
            }
        }

        setTimeout(function(){
            checkForRetries();
        }, params.requestRetryInterval);
    }

    //Helper functions
    function isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    //Create connection
    ws = new WebSocket(url);
    registerListeners();
}