// app.js - Main UI and State Management

const app = {
    state: {
        role: null, // 'sender' | 'receiver'
        channel: null,
        key: null
    },

    // CHANGE THIS WHEN YOU DEPLOY YOUR BACKEND TO PRODUCTION (e.g. "ghostfs-relay.fly.dev")
    PRODUCTION_BACKEND: "localhost:4000",

    getWsUrl(channel, role) {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const domain = isLocal ? "localhost:4000" : this.PRODUCTION_BACKEND;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${domain}/socket?freq=${channel}&role=${role}`;
    },

    init() {
        // Parse URL Hash (e.g., #channel=464.36&key=A1B2...)
        if (window.location.hash) {
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            
            if (params.has('channel')) {
                this.state.channel = params.get('channel');
                document.getElementById('rx-channel').value = this.state.channel;
            }
            if (params.has('key')) {
                this.state.key = params.get('key');
                document.getElementById('rx-key').value = this.state.key;
            }
            
            // If they followed a link, auto-open receiver mode
            if (this.state.channel) {
                this.setRole('receiver');
            }
        }
    },

    setRole(role) {
        this.state.role = role;
        
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        
        // Show selected view
        const view = document.getElementById(`view-${role}`);
        view.classList.remove('hidden');
        view.classList.add('active');
        
        document.getElementById('global-status').innerText = `ROLE: ${role.toUpperCase()}`;
    },

    showLanding() {
        this.state.role = null;
        this.state.channel = null;
        this.state.key = null;
        
        // Clear URL Hash without reloading
        history.replaceState(null, null, ' ');
        
        // Clear inputs
        document.getElementById('rx-channel').value = '';
        document.getElementById('rx-key').value = '';
        document.getElementById('file-input').value = '';
        
        document.getElementById('global-status').innerText = "SYSTEM_READY";
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        
        const view = document.getElementById('view-landing');
        view.classList.remove('hidden');
        view.classList.add('active');
        
        // Reset specific view states
        document.getElementById('drop-zone').classList.remove('hidden');
        document.getElementById('sender-active-state').classList.add('hidden');
        
        document.getElementById('receiver-setup').classList.remove('hidden');
        document.getElementById('receiver-active-state').classList.add('hidden');
        document.getElementById('burnout-container').classList.add('hidden');
        
        // Stop video if it's playing
        const video = document.getElementById('decoy-video');
        if (video) video.pause();
    },

    generateChannelId() {
        const p1 = Math.floor(Math.random() * 900) + 100; // 100-999
        const p2 = Math.floor(Math.random() * 90) + 10;   // 10-99
        return `${p1}.${p2}`;
    },

    bytesToSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'error' ? '<i class="ph-fill ph-warning-circle"></i>' : '<i class="ph-fill ph-check-circle"></i>';
        toast.innerHTML = `<span style="font-size: 1.25rem">${icon}</span><span>${message}</span>`;
        
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
};

window.onload = () => app.init();
