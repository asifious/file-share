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
    let connectionEstablished = false;
    let receiverId = '';
    let files = [];
    const outgoingQueue = [];
    
    function sendMessage(obj) {
        const payload = JSON.stringify(obj);
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(payload);
            console.log('Sent:', obj);
        } else {
            outgoingQueue.push(payload);
            console.log('Queued (socket not open):', obj);
        }
    }
    
    function flushQueue() {
        while (outgoingQueue.length > 0 && socket.readyState === WebSocket.OPEN) {
            const payload = outgoingQueue.shift();
            try {
                socket.send(payload);
                console.log('Flushed:', payload);
            } catch (err) {
                console.error('Failed to flush payload:', err);
                outgoingQueue.unshift(payload);
                break;
            }
        }
    }
    
    // Register on open
    socket.onopen = function() {
        console.log('WebSocket connected');
        // Register this client so server can find it (sender or receiver)
        sendMessage({
            type: 'register',
            userId: userId
        });
        // Flush any queued messages (connection-request/file)
        flushQueue();
    };
    
    // Re-register every 30s to ensure server knows we're active
    setInterval(function() {
        if (socket.readyState === WebSocket.OPEN) {
            sendMessage({ type: 'register', userId: userId });
        }
    }, 30000);
    
    socket.onclose = function() {
        console.log('WebSocket closed. ReadyState:', socket.readyState);
        updateConnectionStatus('disconnected', 'Connection closed');
        connectionEstablished = false;
        document.getElementById('sendBtn').disabled = true;
        // Try simple reconnect after short delay
        setTimeout(() => {
            console.log('Attempting WebSocket reconnect...');
            socket = new WebSocket(wsUrl);
            // re-bind handlers (simple approach: reload page or reconnect)
            // For simplicity here, reload to re-run initialization
            // You may implement a full reconnect flow if desired
            location.reload();
        }, 2000);
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus('disconnected', 'Connection error');
        connectionEstablished = false;
        document.getElementById('sendBtn').disabled = true;
    };
    
    // Connection status UI
    const connectionStatus = document.getElementById('connectionStatus');
    
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', function() {
        receiverId = document.getElementById('receiverId').value.trim();
        
        if (!receiverId) {
            alert('Please enter a receiver ID');
            return;
        }
        
        if (receiverId === userId) {
            alert('You cannot send files to yourself');
            return;
        }
        
        updateConnectionStatus('pending', 'Waiting for receiver to accept...');
        
        // Send connection request with timestamp (use sendMessage so it queues if needed)
        sendMessage({
            type: 'connection-request',
            senderId: userId,
            receiverId: receiverId,
            timestamp: new Date().toISOString()
        });
        
        // Set timeout for connection
        setTimeout(() => {
            if (!connectionEstablished) {
                updateConnectionStatus('disconnected', 'Connection timed out');
                alert('Connection timed out. Receiver may not be available.');
            }
        }, 30000);
    });
    
    // File upload handling
    const fileUpload = document.getElementById('fileUpload');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    
    fileUpload.addEventListener('click', function() {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            addFiles(e.target.files);
        }
    });
    
    // Drag and drop
    fileUpload.addEventListener('dragover', function(e) {
        e.preventDefault();
        fileUpload.style.borderColor = '#4285f4';
        fileUpload.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
    });
    
    fileUpload.addEventListener('dragleave', function() {
        fileUpload.style.borderColor = '#e0e0e0';
        fileUpload.style.backgroundColor = '';
    });
    
    fileUpload.addEventListener('drop', function(e) {
        e.preventDefault();
        fileUpload.style.borderColor = '#e0e0e0';
        fileUpload.style.backgroundColor = '';
        
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    });
    
    // Send button
    document.getElementById('sendBtn').addEventListener('click', function() {
        if (!connectionEstablished) {
            alert('Not connected to a receiver');
            return;
        }
        
        if (files.length === 0) {
            alert('No files selected');
            return;
        }
        
        // Send files
        files.forEach((file, index) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const fileData = {
                    type: 'file',
                    senderId: userId,
                    receiverId: receiverId,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    fileData: e.target.result.split(',')[1], // Remove data URL prefix
                    fileIndex: index,
                    totalFiles: files.length
                };
                
                // Use sendMessage so it's queued if socket is not open
                sendMessage(fileData);
                
                // Update UI to show sending progress
                const fileItem = document.getElementById(`file-${index}`);
                const progressFill = fileItem.querySelector('.progress-fill');
                const progressText = fileItem.querySelector('.progress-text');
                
                // Simulate progress (in a real app, this would come from WebSocket)
                let progress = 0;
                const progressInterval = setInterval(() => {
                    progress += 5;
                    if (progress >= 100) {
                        progress = 100;
                        clearInterval(progressInterval);
                        fileItem.querySelector('.progress-text').textContent = 'Completed';
                        fileItem.querySelector('.progress-text').style.color = '#34a853';
                    }
                    
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `${progress}% - Sending...`;
                }, 100);
            };
            
            reader.readAsDataURL(file);
        });
    });
    
    // WebSocket message handling
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        console.log('Received:', data);
        
        if (data.type === 'connection-accepted') {
            updateConnectionStatus('connected', 'Connected to receiver');
            connectionEstablished = true;
            document.getElementById('sendBtn').disabled = false;
        } else if (data.type === 'connection-rejected') {
            updateConnectionStatus('disconnected', 'Connection rejected by receiver');
            connectionEstablished = false;
            document.getElementById('sendBtn').disabled = true;
        } else if (data.type === 'file-progress') {
            // Update progress for specific file
            const fileItem = document.getElementById(`file-${data.fileIndex}`);
            if (fileItem) {
                const progressFill = fileItem.querySelector('.progress-fill');
                const progressText = fileItem.querySelector('.progress-text');
                
                progressFill.style.width = `${data.progress}%`;
                progressText.textContent = `${data.progress}% - Sending...`;
                
                if (data.progress === 100) {
                    progressText.textContent = 'Completed';
                    progressText.style.color = '#34a853';
                }
            }
        }
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
    
    function updateConnectionStatus(status, message) {
        connectionStatus.className = `connection-status ${status}`;
        connectionStatus.innerHTML = `<i class="fas fa-${status === 'connected' ? 'check-circle' : status === 'pending' ? 'hourglass-half' : 'plug'}"></i> ${message}`;
    }
    
    function addFiles(newFiles) {
        for (let i = 0; i < newFiles.length; i++) {
            const file = newFiles[i];
            files.push(file);
            
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.id = `file-${files.length - 1}`;
            
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.innerHTML = getFileIcon(file);
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = file.name;
            
            const fileSize = document.createElement('div');
            fileSize.className = 'file-size';
            fileSize.textContent = formatFileSize(file.size);
            
            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileSize);
            
            const fileRemove = document.createElement('button');
            fileRemove.className = 'file-remove';
            fileRemove.innerHTML = '<i class="fas fa-times"></i>';
            fileRemove.addEventListener('click', function() {
                removeFile(files.length - 1);
            });
            
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.width = '0%';
            
            progressBar.appendChild(progressFill);
            
            const progressText = document.createElement('div');
            progressText.className = 'progress-text';
            progressText.textContent = '0% - Waiting to send';
            
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(progressText);
            
            fileItem.appendChild(fileIcon);
            fileItem.appendChild(fileInfo);
            fileItem.appendChild(fileRemove);
            fileItem.appendChild(progressContainer);
            
            fileList.appendChild(fileItem);
        }
    }
    
    function removeFile(index) {
        files.splice(index, 1);
        renderFileList();
    }
    
    function renderFileList() {
        fileList.innerHTML = '';
        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.id = `file-${index}`;
            
            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.innerHTML = getFileIcon(file);
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const fileName = document.createElement('div');
            fileName.className = 'file-name';
            fileName.textContent = file.name;
            
            const fileSize = document.createElement('div');
            fileSize.className = 'file-size';
            fileSize.textContent = formatFileSize(file.size);
            
            fileInfo.appendChild(fileName);
            fileInfo.appendChild(fileSize);
            
            const fileRemove = document.createElement('button');
            fileRemove.className = 'file-remove';
            fileRemove.innerHTML = '<i class="fas fa-times"></i>';
            fileRemove.addEventListener('click', function() {
                removeFile(index);
            });
            
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.width = '0%';
            
            progressBar.appendChild(progressFill);
            
            const progressText = document.createElement('div');
            progressText.className = 'progress-text';
            progressText.textContent = '0% - Waiting to send';
            
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(progressText);
            
            fileItem.appendChild(fileIcon);
            fileItem.appendChild(fileInfo);
            fileItem.appendChild(fileRemove);
            fileItem.appendChild(progressContainer);
            
            fileList.appendChild(fileItem);
        });
    }
    
    function getFileIcon(file) {
        const type = file.type.split('/')[0];
        const extension = file.name.split('.').pop().toLowerCase();
        
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
});