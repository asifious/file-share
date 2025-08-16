document.addEventListener('DOMContentLoaded', function() {
    // Get or create persistent user ID
    const userId = getOrCreateUserId();
    document.getElementById('userId').textContent = userId;
    
    // Copy ID button
    document.getElementById('copyId').addEventListener('click', function() {
        navigator.clipboard.writeText(userId);
        const copyBtn = document.getElementById('copyId');
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';

        // Show tooltip
        let tooltip = document.createElement('span');
        tooltip.className = 'copy-tooltip';
        tooltip.textContent = 'Copied!';
        copyBtn.appendChild(tooltip);

        setTimeout(() => {
            copyBtn.innerHTML = '<i class="far fa-copy"></i>';
        }, 2000);

        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 1200);
    });
    
    // Navigation buttons
    document.getElementById('sendBtn').addEventListener('click', function() {
        window.location.href = 'send.html';
    });
    
    document.getElementById('receiveBtn').addEventListener('click', function() {
        window.location.href = 'receive.html';
    });
    
    // Get or create a persistent user ID stored in localStorage
    function getOrCreateUserId() {
        const key = 'sfsUserId';
        let id = localStorage.getItem(key);
        if (!id) {
            const prefix = 'user-';
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous characters
            let result = '';
            
            for (let i = 0; i < 6; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            id = prefix + result;
            localStorage.setItem(key, id);
        }
        return id;
    }
});