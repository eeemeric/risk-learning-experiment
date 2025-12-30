// ========================================
// OFFLINE SUPPORT - Caching Functions
// ========================================

console.log("OFFLINE SUPPORT LOADED");

// Cache keys
const CACHE_KEYS = {
    SURE_IMAGES: 'cached_sure_images',
    GAMBLE_IMAGES: 'cached_gamble_images',
    SOUND: 'cached_reward_sound',
    PARAMS: 'cached_parameters_',
    LAST_SYNC: 'last_sync_time'
};

// ========================================
// CHECK ONLINE STATUS
// ========================================

let isOnline = navigator.onLine;

window.addEventListener('online', () => {
    isOnline = true;
    console.log("Back online!");
    updateConnectionStatus();
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log("Offline mode activated");
    updateConnectionStatus();
});

function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        if (isOnline) {
            statusEl.innerHTML = '🟢 Online';
            statusEl.style.color = 'green';
        } else {
            statusEl.innerHTML = '🔴 Offline (Using Cached Data)';
            statusEl.style.color = 'red';
        }
    }
}

// ========================================
// CACHE MANAGEMENT
// ========================================

function cacheImages(key, images) {
    try {
        const imagesToCache = images.map(img => ({
            path: img.path,
            type: img.type,
            imageData: img.image.src  // Store the data URL
        }));
        localStorage.setItem(key, JSON.stringify(imagesToCache));
        console.log(`Cached ${images.length} images to ${key}`);
        return true;
    } catch (error) {
        console.error(`Error caching images: ${error.message}`);
        return false;
    }
}

function getCachedImages(key) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        const imagesToRestore = JSON.parse(cached);
        const restoredImages = imagesToRestore.map(img => {
            const image = new Image();
            image.src = img.imageData;
            return {
                path: img.path,
                type: img.type,
                image: image
            };
        });
        
        console.log(`Restored ${restoredImages.length} images from ${key}`);
        return restoredImages;
    } catch (error) {
        console.error(`Error retrieving cached images: ${error.message}`);
        return null;
    }
}

function cacheParameters(subject, params) {
    try {
        const key = CACHE_KEYS.PARAMS + subject;
        localStorage.setItem(key, JSON.stringify(params));
        localStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
        console.log(`Cached parameters for ${subject}`);
        return true;
    } catch (error) {
        console.error(`Error caching parameters: ${error.message}`);
        return false;
    }
}

function getCachedParameters(subject) {
    try {
        const key = CACHE_KEYS.PARAMS + subject;
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        console.log(`Retrieved cached parameters for ${subject}`);
        return JSON.parse(cached);
    } catch (error) {
        console.error(`Error retrieving cached parameters: ${error.message}`);
        return null;
    }
}

function cacheSound(audioBuffer) {
    try {
        // Convert AudioBuffer to JSON-serializable format
        const offlineContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        const soundData = {
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            sampleRate: audioBuffer.sampleRate,
            channelData: []
        };
        
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            soundData.channelData.push(Array.from(audioBuffer.getChannelData(i)));
        }
        
        localStorage.setItem(CACHE_KEYS.SOUND, JSON.stringify(soundData));
        console.log("Cached reward sound");
        return true;
    } catch (error) {
        console.error(`Error caching sound: ${error.message}`);
        return false;
    }
}

function getCachedSound() {
    try {
        const cached = localStorage.getItem(CACHE_KEYS.SOUND);
        if (!cached) return null;
        
        const soundData = JSON.parse(cached);
        const audioBuffer = audiocontext.createBuffer(
            soundData.numberOfChannels,
            soundData.length,
            soundData.sampleRate
        );
        
        for (let i = 0; i < soundData.numberOfChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            channelData.set(soundData.channelData[i]);
        }
        
        console.log("Retrieved cached reward sound");
        return audioBuffer;
    } catch (error) {
        console.error(`Error retrieving cached sound: ${error.message}`);
        return null;
    }
}

function getCacheSize() {
    try {
        let size = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                size += localStorage[key].length + key.length;
            }
        }
        return (size / 1024).toFixed(2);  // KB
    } catch (error) {
        return "Unknown";
    }
}

function clearCache() {
    try {
        localStorage.clear();
        console.log("Cache cleared");
        return true;
    } catch (error) {
        console.error(`Error clearing cache: ${error.message}`);
        return false;
    }
}

// ========================================
// DISPLAY CACHE INFO
// ========================================

function showCacheInfo() {
    const size = getCacheSize();
    console.log(`Cache size: ${size} KB`);
    alert(`Cache size: ${size} KB\n\nClick "Clear Cache" to free space.`);
}
