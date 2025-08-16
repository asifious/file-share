const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class WSServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.connections = new Map(); // userId -> WebSocket
        this.pendingRequests = new Map(); // requestId -> requestData
        
        this.setupEventHandlers();
    }
    
    setupEventHandlers() {
        this.wss.on('connection', (ws) => {
            console.log('New client connected');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });
            
            ws.on('close', () => {
                this.handleDisconnection(ws);
            });
        });
    }
    
    handleMessage(ws, data) {
        switch (data.type) {
            case 'register-receiver':
                this.registerReceiver(ws, data.userId);
                break;
            case 'register':
                // Generic register for any client (sender or receiver)
                this.registerReceiver(ws, data.userId);
                break;
                
            case 'connection-request':
                this.handleConnectionRequest(data);
                break;
                
            case 'connection-response':
                this.handleConnectionResponse(data);
                break;
                
            case 'file':
                this.handleFileTransfer(data);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    registerReceiver(ws, userId) {
        this.connections.set(userId, ws);
        console.log(`Client registered: ${userId}`);
    }
    
    // Update the handleConnectionRequest method in WSServer class
    handleConnectionRequest(data) {
        const requestId = uuidv4();
        data.requestId = requestId; // Add requestId to the data
        this.pendingRequests.set(requestId, data);
        
        console.log(`Connection request from ${data.senderId} to ${data.receiverId}`);
        
        const receiverWs = this.connections.get(data.receiverId);
        if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            console.log(`Sending request to receiver ${data.receiverId}`);
            receiverWs.send(JSON.stringify({
                type: 'connection-request',
                requestId: requestId,
                senderId: data.senderId,
                receiverId: data.receiverId,
                timestamp: new Date().toISOString()
            }));
        } else {
            console.log(`Receiver ${data.receiverId} not found or not connected`);
            const senderWs = this.connections.get(data.senderId);
            if (senderWs && senderWs.readyState === WebSocket.OPEN) {
                senderWs.send(JSON.stringify({
                    type: 'connection-rejected',
                    reason: 'Receiver not available'
                }));
            }
        }
    }
    
    handleConnectionResponse(data) {
        const request = this.pendingRequests.get(data.requestId);
        if (!request) return;
        
        this.pendingRequests.delete(data.requestId);
        
        const senderWs = this.connections.get(data.senderId);
        if (senderWs) {
            if (data.accepted) {
                senderWs.send(JSON.stringify({
                    type: 'connection-accepted',
                    receiverId: data.receiverId
                }));
            } else {
                senderWs.send(JSON.stringify({
                    type: 'connection-rejected',
                    reason: 'Receiver declined the request'
                }));
            }
        }
    }
    
    handleFileTransfer(data) {
        const receiverWs = this.connections.get(data.receiverId);
        if (!receiverWs) {
            console.log(`Receiver ${data.receiverId} not found`);
            return;
        }
        
        // Simulate progress updates
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(progressInterval);
            }
            
            receiverWs.send(JSON.stringify({
                type: 'file-progress',
                senderId: data.senderId,
                fileIndex: data.fileIndex,
                progress: progress
            }));
            
            // Also send progress back to sender
            const senderWs = this.connections.get(data.senderId);
            if (senderWs) {
                senderWs.send(JSON.stringify({
                    type: 'file-progress',
                    fileIndex: data.fileIndex,
                    progress: progress
                }));
            }
            
            if (progress === 100) {
                // Send the complete file data
                receiverWs.send(JSON.stringify({
                    ...data,
                    progress: 100
                }));
            }
        }, 300);
    }
    
    handleDisconnection(ws) {
        for (const [userId, connection] of this.connections.entries()) {
            if (connection === ws) {
                this.connections.delete(userId);
                console.log(`Client disconnected: ${userId}`);
                break;
            }
        }
    }
}

module.exports = WSServer;