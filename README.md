# File Share

A modern web application for sending files between devices (mobile-to-mobile, PC-to-PC, or mobile-to-PC).

## Features

- Auto-generated temporary user ID
- Send and receive files
- Cross-platform compatibility
- Real-time progress tracking
- Connection request system
- Drag and drop file upload
- Multiple file selection

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. Open `http://localhost:3000` in your browser

## Project Structure

```markdown
## Project Structure

```bash
file-share/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── send.js
│   │   └── receive.js
│   └── index.html
├── server/
│   ├── server.js
│   └── ws-server.js
├── package.json
└── README.md

## Usage

1. Open the application in two different browsers/devices
2. On the receiving device, click "Receive Files"
3. On the sending device, click "Send Files" and enter the receiver's ID
4. Connect and send files

## Technology Stack

- Frontend: HTML5, CSS3, JavaScript

- Backend: Node.js, Express, WebSocket

