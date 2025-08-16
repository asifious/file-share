const express = require('express');
const http = require('http');
const path = require('path');
const WSServer = require('./ws-server');

const app = express();
const server = http.createServer(app);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Start WebSocket server
new WSServer(server);

// WebSocket server is started above with: new WSServer(server);
// Add this to the WSServer constructor
// constructor(server) {
//     this.wss = new WebSocket.Server({ server });
//     this.connections = new Map();
//     this.pendingRequests = new Map();
    
//     // Log connection status
//     setInterval(() => {
//         console.log('Current connections:');
//         this.connections.forEach((ws, userId) => {
//             console.log(`- ${userId}: ${ws.readyState === WebSocket.OPEN ? 'Open' : 'Closed'}`);
//         });
//     }, 10000);
    
//     this.setupEventHandlers();
// };

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

