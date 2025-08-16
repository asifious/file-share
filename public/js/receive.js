document.addEventListener('DOMContentLoaded', function() {
    // Get or create persistent user ID
    const userId = getOrCreateUserId();
    document.getElementById('userId').textContent = userId;
    
    // Back button
    document.getElementById('backBtn').addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    
    // Copy ID button
    document.getElementById('copyId').addEventListener('click', function() {
        navigator.clipboard.writeText(userId);
        const copyBtn = document.getElementById('copyId');
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            copyBtn.innerHTML = '<i class="far fa-copy"></i>';
        }, 2000);
    });
    
    // WebSocket connection (connect to same host as page)
    const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    let socket = new WebSocket(wsUrl);
    let requireApproval = true;
    let pendingRequests = [];
    let incomingFiles = [];
    let currentRequestId = null;
    let connectedSender = null; // <-- new: track connected sender

    // WebSocket open/register with keep-alive
    socket.onopen = function() {
        console.log('WebSocket connected');
        // Register as a client (so server can find this user)
        const register = () => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'register',
                    userId: userId
                }));
            }
        };
        
        register();
        // Re-register every 30 seconds to maintain connection
        setInterval(register, 30000);
    };

    // Toggle switch
    const approvalToggle = document.getElementById('approvalToggle');
    approvalToggle.addEventListener('change', function() {
        requireApproval = this.checked;
    });
    
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connection-request') {
            handleConnectionRequest(data);
        } else if (data.type === 'file') {
            handleIncomingFile(data);
        } else if (data.type === 'file-progress') {
            updateFileProgress(data);
        }
    };
    
    socket.onclose = function() {
        console.log('WebSocket disconnected');
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
    
    // Helper functions
    
    // Replaced generateUserId with persistent getter
    function getOrCreateUserId() {
        const key = 'sfsUserId';
        let id = localStorage.getItem(key);
        if (!id) {
            const prefix = 'user-';
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let result = '';
            
            for (let i = 0; i < 6; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            id = prefix + result;
            localStorage.setItem(key, id);
        }
        return id;
    }
    
    function handleConnectionRequest(request) {
        currentRequestId = request.requestId;
        
        if (!requireApproval) {
            // Auto-approve
            socket.send(JSON.stringify({
                type: 'connection-response',
                requestId: request.requestId,
                senderId: request.senderId,
                receiverId: userId,
                accepted: true
            }));
            // show who connected
            connectedSender = request.senderId;
            renderConnectedSender();
            return;
        }
        
        // Add to pending requests
        pendingRequests.push(request);
        renderPendingRequests();
        
        // Notify UI (request notification permission if needed)
        if (window.Notification && Notification.permission === 'granted') {
            new Notification('Simple File Share', {
                body: `Connection request from ${request.senderId}`
            });
        } else if (window.Notification && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('Simple File Share', {
                        body: `Connection request from ${request.senderId}`
                    });
                }
            });
        }
    }
    
    function handleIncomingFile(fileData) {
        // Find existing entry for this sender/file index
        const existingFileIndex = incomingFiles.findIndex(f =>
            f.fileIndex === fileData.fileIndex && f.senderId === fileData.senderId);

        if (existingFileIndex === -1) {
            // New incoming file entry. Store any provided base64 chunk and progress.
            incomingFiles.push({
                senderId: fileData.senderId,
                fileIndex: fileData.fileIndex,
                fileName: fileData.fileName,
                fileType: fileData.fileType,
                fileSize: fileData.fileSize,
                progress: fileData.progress || 0,
                // keep receivedData array in case server sends chunks; also store latest fileData if present
                receivedData: fileData.fileData ? [fileData.fileData] : [],
                fileData: fileData.fileData || null
            });
        } else {
            // Update existing entry
            const entry = incomingFiles[existingFileIndex];

            if (fileData.fileData) {
                // Append chunk (or final full payload)
                entry.receivedData.push(fileData.fileData);
                entry.fileData = fileData.fileData; // keep latest (final) payload if provided
            }

            // Update progress if provided
            if (typeof fileData.progress === 'number') {
                entry.progress = fileData.progress;
            }
        }

        renderIncomingFiles();

        // If this message contains the final chunk / progress 100, assemble and download
        const progressedToComplete = (fileData.progress === 100);
        if (progressedToComplete) {
            // Find the stored entry so we use the assembled payload if available
            const entry = incomingFiles.find(f =>
                f.fileIndex === fileData.fileIndex && f.senderId === fileData.senderId);

            if (!entry) return;

            // Prefer explicit fileData (server may include it on completion), otherwise join receivedData
            const base64Data = entry.fileData || entry.receivedData.join('');

            // small delay to let UI update before download
            setTimeout(() => {
                downloadFile({
                    senderId: entry.senderId,
                    fileIndex: entry.fileIndex,
                    fileName: entry.fileName,
                    fileType: entry.fileType,
                    fileSize: entry.fileSize,
                    fileData: base64Data
                });
            }, 300);
        }
    }
    
    function updateFileProgress(fileData) {
        const fileIndex = incomingFiles.findIndex(f =>
            f.fileIndex === fileData.fileIndex && f.senderId === fileData.senderId);

        if (fileIndex !== -1) {
            incomingFiles[fileIndex].progress = fileData.progress;
            renderIncomingFiles();
        }
    }
    
    function renderPendingRequests() {
        const pendingRequestsContainer = document.getElementById('pendingRequests');
        
        if (pendingRequests.length === 0) {
            pendingRequestsContainer.innerHTML = '';
            // still render connected sender if any
            renderConnectedSender();
            return;
        }
        
        pendingRequestsContainer.innerHTML = '<h3>Pending Requests</h3>';
        
        pendingRequests.forEach((request, index) => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item';
            
            const requestInfo = document.createElement('div');
            requestInfo.innerHTML = `<strong>${request.senderId}</strong> wants to send you files`;
            
            const requestActions = document.createElement('div');
            requestActions.className = 'request-actions';
            
            const approveBtn = document.createElement('button');
            approveBtn.className = 'request-approve';
            approveBtn.textContent = 'Approve';
            approveBtn.addEventListener('click', function() {
                approveRequest(index, true);
            });
            
            const denyBtn = document.createElement('button');
            denyBtn.className = 'request-deny';
            denyBtn.textContent = 'Deny';
            denyBtn.addEventListener('click', function() {
                approveRequest(index, false);
            });
            
            requestActions.appendChild(approveBtn);
            requestActions.appendChild(denyBtn);
            
            requestItem.appendChild(requestInfo);
            requestItem.appendChild(requestActions);
            
            pendingRequestsContainer.appendChild(requestItem);
        });
    }
    
    function renderIncomingFiles() {
        const incomingFilesContainer = document.getElementById('incomingFiles');
        
        if (incomingFiles.length === 0) {
            incomingFilesContainer.innerHTML = '<p>No incoming files</p>';
            return;
        }
        
        incomingFilesContainer.innerHTML = '<h3>Incoming Files</h3>';
        
        incomingFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.id = `incoming-file-${index}`;
            
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.innerHTML = getFileIcon(file);
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const senderInfo = document.createElement('div');
            senderInfo.className = 'file-name';
            senderInfo.textContent = `From: ${file.senderId}`;
            
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = file.fileName;
            
            const fileSize = document.createElement('div');
            fileSize.className = 'file-size';
            fileSize.textContent = formatFileSize(file.fileSize);
            
            fileInfo.appendChild(senderInfo);
            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileSize);
            
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.width = `${file.progress}%`;
            
            progressBar.appendChild(progressFill);
            
            const progressText = document.createElement('div');
            progressText.className = 'progress-text';
            progressText.textContent = `${file.progress}% - Receiving...`;
            
            if (file.progress === 100) {
                progressText.textContent = 'Completed';
                progressText.style.color = '#34a853';
                
                const completedIcon = document.createElement('div');
                completedIcon.className = 'completed';
                completedIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
                fileItem.appendChild(completedIcon);
            }
            
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(progressText);
            
            fileItem.appendChild(fileIcon);
            fileItem.appendChild(fileInfo);
            fileItem.appendChild(progressContainer);
            
            incomingFilesContainer.appendChild(fileItem);
        });
    }
    
    function approveRequest(index, approved) {
        const request = pendingRequests[index];
        
        socket.send(JSON.stringify({
            type: 'connection-response',
            requestId: request.requestId,
            senderId: request.senderId,
            receiverId: userId,
            accepted: approved
        }));
        
        // If approved, mark this sender as connected and show it in UI
        if (approved) {
            connectedSender = request.senderId;
            renderConnectedSender();
        }

        pendingRequests.splice(index, 1);
        renderPendingRequests();
    }
    
    function downloadFile(fileData) {
        // Convert base64 to Uint8Array then Blob (more reliable for binary files)
        const b64 = fileData.fileData || '';
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: fileData.fileType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = fileData.fileName || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function getFileIcon(file) {
        const type = file.fileType ? file.fileType.split('/')[0] : '';
        const extension = file.fileName.split('.').pop().toLowerCase();
        
        const iconMap = {
            image: 'fa-image',
            audio: 'fa-music',
            video: 'fa-film',
            text: 'fa-file-alt',
            pdf: 'fa-file-pdf',
            zip: 'fa-file-archive',
            doc: 'fa-file-word',
            docx: 'fa-file-word',
            xls: 'fa-file-excel',
            xlsx: 'fa-file-excel',
            ppt: 'fa-file-powerpoint',
            pptx: 'fa-file-powerpoint',
            default: 'fa-file'
        };
        
        if (type in iconMap) {
            return `<i class="fas ${iconMap[type]}"></i>`;
        } else if (extension in iconMap) {
            return `<i class="fas ${iconMap[extension]}"></i>`;
        } else {
            return `<i class="fas ${iconMap.default}"></i>`;
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // New helper to show connected sender above incoming files
    function renderConnectedSender() {
        const incomingFilesContainer = document.getElementById('incomingFiles');
        if (!incomingFilesContainer) return;

        let wrapper = document.getElementById('connectedSenderDisplay');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = 'connectedSenderDisplay';
            wrapper.className = 'connected-sender';
            // insert before incoming files container
            incomingFilesContainer.parentNode.insertBefore(wrapper, incomingFilesContainer);
        }

        if (connectedSender) {
            wrapper.innerHTML = `<strong>Connected sender:</strong> <span class="sender-id">${connectedSender}</span>`;
        } else {
            wrapper.innerHTML = '';
        }
    }
});