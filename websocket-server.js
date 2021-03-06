const WebSocket = require('ws');
const jwtAuthenticator = require('./helpers/jwtAuthenticator');

exports.createServer = (httpServer) => {
    // Start websocket server
    const wss = new WebSocket.Server({server: httpServer});

    // Emit an event for received messages
    function toEvent(ws, data) {
        try {
            const event = JSON.parse(data);
            if (!event.type || !event.payload) {
                throw new Error("Message JSON needs to have 'type' and 'payload'");
            }
            ws.emit(event.type, event.payload);
        } catch (err) {
            ws.send(JSON.stringify({error: err.message}));
        }
    }

    wss.on('connection', function connection(ws) {
        ws
            // On message event convert message to an event and emit it
            .on('message', (data) => toEvent(ws, data))
            // On authorization event verify JWT token sent by client
            .on('authorization', (data) => {
                jwtAuthenticator.verify(data.token, (err, decoded) => {
                    if (err) {
                        ws.send(JSON.stringify({error: err.message}));
                    } else {
                        // If authenticated add username to ws-object to know that user is authenticated
                        ws.username = decoded.username;
                    }
                });
            })
            .on('chat', (data) => {
                // Check if sender is authenticated
                if (ws.username) {
                    wss.clients.forEach((client) => {
                        // Send only if client is not the sender and if client is authenticated
                        if (client !== ws && client.username && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                username: ws.username,
                                message: data.message,
                                date: data.date
                            }));
                        }
                    });
                } else {
                    ws.send(JSON.stringify({error: 'You are not authenticated'}));
                }
            });
    });
};