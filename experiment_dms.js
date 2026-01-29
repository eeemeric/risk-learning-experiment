// ========================================
// DELAYED MATCHING-TO-SAMPLE EXPERIMENT
// ========================================

console.log("EXPERIMENT_DMS.JS LOADED - VERSION 42 - " + new Date());

// Global variables
let currentTrial = 0;
let totalTrials = 0;
let experimentData = [];
let params = {};
let subjectName = "";
let loadedImages = { sure: [], gamble: [] };
let ble = null;

// DMS-specific variables
let allImages = [];
let sampleImage = null;
let distractorImage = null;

// ========================================
// LOAD ASSETS FROM DROPBOX
// ========================================

async function loadAssetsFromDropbox() {
    window.logDebug("Loading DMS assets...");
    
    try {
        // Load sure options
        window.logDebug("Loading sure options...");
        const surePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/sure_options");
        for (const path of surePaths) {
            const image = await loadImageFromDropbox(path);
            loadedImages.sure.push({ path: path, image: image });
        }
        window.logDebug(`Loaded ${loadedImages.sure.length} sure images`);
        
        // Load gamble options
        window.logDebug("Loading gamble options...");
        const gamblePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/gamble_options");
        for (const path of gamblePaths) {
            const image = await loadImageFromDropbox(path);
            loadedImages.gamble.push({ path: path, image: image });
        }
        window.logDebug(`Loaded ${loadedImages.gamble.length} gamble images`);
        
        // Combine all images for random selection
        allImages = [...loadedImages.sure, ...loadedImages.gamble];
        window.logDebug(`Total images available: ${allImages.length}`);
        
        // Load reward sound
        window.logDebug("Loading reward sound...");
        await loadRewardSound();
        window.logDebug("Reward sound loaded!");
        
        // Load error sound
        window.logDebug("Loading error sound...");
        await loadErrorSound();
        window.logDebug("Error sound loaded!");
        
        totalTrials = params.NumTrials || 100;
        window.logDebug(`DMS experiment ready: ${totalTrials} trials`);
        
    } catch (error) {
        window.logDebug(`Asset loading error: ${error.message}`);
        throw error;
    }
}

async function loadImageFromDropbox(imagePath) {
    try {
        const response = await dbx.filesDownload({ path: imagePath });
        const blob = response.result.fileBlob;
        const imageUrl = window.URL.createObjectURL(blob);
        
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = function() {
                resolve(image);
            };
            image.onerror = function() {
                reject(new Error("Image load failed: " + imagePath));
            };
            image.src = imageUrl;
        });
    } catch (error) {
        throw error;
    }
}

async function getDropboxFolderContents(folderPath) {
    try {
        const response = await dbx.filesListFolder({ path: folderPath });
        const imageFiles = response.result.entries
            .filter(entry => entry['.tag'] === 'file' && entry.name.endsWith('.png'))
            .map(entry => entry.path_lower);
        return imageFiles;
    } catch (error) {
        window.logDebug(`Error getting folder contents: ${error.message}`);
        return [];
    }
}

// ========================================
// LOAD PARAMETERS
// ========================================

async function loadSubjectParameters(subject) {
    window.logDebug("Loading DMS parameters for subject: " + subject);
    
    try {
        const paramPath = `/mkturkfolders/parameterfiles/subjects/${subject}_params.txt`;
        window.logDebug(`Attempting to load: ${paramPath}`);
        
        const response = await dbx.filesDownload({ path: paramPath });
        const blob = response.result.fileBlob;
        const text = await blob.text();
        params = JSON.parse(text);
        
        window.logDebug("DMS Parameters loaded successfully!");
        return true;
        
    } catch (error) {
        window.logDebug(`Error loading parameters: ${error.message}`);
        return false;
    }
}

// ========================================
// TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    window.logDebug(`DMS Trial ${currentTrial + 1} starting`);
    
    // Select random sample image
    sampleImage = allImages[Math.floor(Math.random() * allImages.length)];
    window.logDebug(`Sample: ${sampleImage.path}`);
    
    // Select random distractor (different from sample)
    let distractorIndex;
    do {
        distractorIndex = Math.floor(Math.random() * allImages.length);
    } while (allImages[distractorIndex].path === sampleImage.path);
    distractorImage = allImages[distractorIndex];
    window.logDebug(`Distractor: ${distractorImage.path}`);
    
    // Phase 1: Sample presentation (500ms)
    window.logDebug("Phase 1: Sample presentation (500ms)");
    await presentSample(sampleImage);
    
    // Phase 2: Delay (1000ms blank screen)
    window.logDebug("Phase 2: Delay (1000ms)");
    await presentDelay();
    
    // Phase 3: Test (2 options)
    window.logDebug("Phase 3: Test presentation");
    const response = await presentTest(sampleImage, distractorImage);
    
    // Save trial data
    const correct = response.correct;
    window.logDebug(`Response: ${correct ? 'CORRECT' : 'INCORRECT'}`);
    
    experimentData.push({
        trial: currentTrial + 1,
        sampleImage: sampleImage.path,
        distractorImage: distractorImage.path,
        chosenImage: response.chosenImage,
        correct: correct,
        reactionTime: response.reactionTime,
        timestamp: new Date().toISOString()
    });
    
    // Feedback
    if (correct) {
        window.logDebug("Correct - delivering reward");
        await playRewardSound();
        await deliverReward();
    } else {
        window.logDebug("Incorrect - playing error sound");
        await playErrorSound();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Blank screen for 2 sec
    }
    
    // Inter-trial interval (1 second)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    currentTrial++;
    
    if (currentTrial < totalTrials) {
        runTrial();
    } else {
        endExperiment();
    }
}

// ========================================
// DMS PHASES
// ========================================

async function presentSample(image) {
    return new Promise((resolve) => {
        const container = document.getElementById('experiment-container');
        container.innerHTML = '';
        
        const stimulus = document.createElement('img');
        stimulus.src = image.image.src;
        stimulus.style.maxWidth = '80%';
        stimulus.style.maxHeight = '80%';
        stimulus.style.position = 'absolute';
        stimulus.style.left = '50%';
        stimulus.style.top = '50%';
        stimulus.style.transform = 'translate(-50%, -50%)';
        
        container.appendChild(stimulus);
        
        setTimeout(() => {
            container.innerHTML = '';
            resolve();
        }, 500);
    });
}

async function presentDelay() {
    return new Promise((resolve) => {
        const container = document.getElementById('experiment-container');
        container.innerHTML = '';
        
        setTimeout(() => {
            resolve();
        }, 1000);
    });
}

async function presentTest(correctImage, incorrectImage) {
    return new Promise((resolve) => {
        const container = document.getElementById('experiment-container');
        container.innerHTML = '';
        
        // Randomize left/right positions
        const positions = Math.random() > 0.5 
            ? { correct: 'left', incorrect: 'right' }
            : { correct: 'right', incorrect: 'left' };
        
        const startTime = Date.now();
        let responseMade = false;
        
        // Create test stimuli
        const createStimulus = (image, position) => {
            const stimulus = document.createElement('img');
            stimulus.src = image.image.src;
            stimulus.style.maxWidth = '40%';
            stimulus.style.maxHeight = '40%';
            stimulus.style.position = 'absolute';
            stimulus.style.top = '50%';
            stimulus.style.transform = 'translateY(-50%)';
            stimulus.style.cursor = 'pointer';
            stimulus.style.zIndex = '10';
            
            if (position === 'left') {
                stimulus.style.left = '10%';
            } else {
                stimulus.style.right = '10%';
            }
            
            return stimulus;
        };
        
        const correctStimulus = createStimulus(correctImage, positions.correct);
        const incorrectStimulus = createStimulus(incorrectImage, positions.incorrect);
        
        container.appendChild(correctStimulus);
        container.appendChild(incorrectStimulus);
        
        // Handle clicks
        correctStimulus.addEventListener('click', () => {
            if (!responseMade) {
                responseMade = true;
                const reactionTime = Date.now() - startTime;
                
                // Keep stimulus visible during reward
                setTimeout(() => {
                    resolve({
                        correct: true,
                        chosenImage: correctImage.path,
                        reactionTime: reactionTime
                    });
                }, 300); // Brief delay to show selection
            }
        });
        
        incorrectStimulus.addEventListener('click', () => {
            if (!responseMade) {
                responseMade = true;
                const reactionTime = Date.now() - startTime;
                
                container.innerHTML = '';
                resolve({
                    correct: false,
                    chosenImage: incorrectImage.path,
                    reactionTime: reactionTime
                });
            }
        });
    });
}

// ========================================
// FEEDBACK SOUNDS
// ========================================

async function playRewardSound() {
    try {
        if (audiocontext && audiocontext.state === 'suspended') {
            await audiocontext.resume();
        }
        
        if (sounds && sounds.buffer && sounds.buffer[0]) {
            const source = audiocontext.createBufferSource();
            source.buffer = sounds.buffer[0];
            source.connect(audiocontext.destination);
            source.start(0);
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        window.logDebug(`Sound error: ${error.message}`);
    }
}

async function playErrorSound() {
    try {
        if (audiocontext && audiocontext.state === 'suspended') {
            await audiocontext.resume();
        }
        
        if (sounds && sounds.buffer && sounds.buffer[1]) {
            const source = audiocontext.createBufferSource();
            source.buffer = sounds.buffer[1];
            source.connect(audiocontext.destination);
            source.start(0);
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        window.logDebug(`Error sound error: ${error.message}`);
    }
}

async function loadRewardSound() {
    // Placeholder - uses existing sounds array
}

async function loadErrorSound() {
    // Placeholder - uses existing sounds array
}

// ========================================
// REWARD DELIVERY
// ========================================

async function deliverReward() {
    const pumpDuration = params.PumpDuration || 100;
    
    if (typeof pumpCharacteristic !== 'undefined' && pumpCharacteristic !== null) {
        await sendPumpCommand(pumpDuration);
    } else if (ble && ble.connected) {
        await writepumpdurationtoBLE(pumpDuration);
    }
}

// ========================================
// EXPERIMENT LIFECYCLE
// ========================================

async function startExperiment() {
    console.log('Starting DMS Experiment...');
    window.logDebug('Starting DMS Experiment...');
    
    // Check token
    const token = localStorage.getItem('dropbox_access_token');
    if (token) {
        window.logDebug(`Token found: ${token.substring(0, 20)}...`);
    } else {
        window.logDebug(`NO TOKEN IN LOCALSTORAGE`);
        alert('No Dropbox token found. Please refresh and authorize.');
        return;
    }
    
    const subjectSelect = document.getElementById('subject-select');
    subjectName = subjectSelect.value;
    
    if (!subjectName) {
        alert('Please select a subject first!');
        return;
    }
    
    window.logDebug('Loading parameters...');
    const paramsLoaded = await loadSubjectParameters(subjectName);
    if (!paramsLoaded) {
        alert('Failed to load subject parameters.');
        return;
    }
    window.logDebug('Parameters loaded!');
    
    window.logDebug('Initializing audio...');
    initializeAudio();
    window.logDebug('Audio initialized!');
    
    window.logDebug('Loading assets from Dropbox...');
    await loadAssetsFromDropbox();
    window.logDebug('Assets loaded!');
    
    // Hide launch screen elements
    document.getElementById('connection-status').style.display = 'none';
    document.getElementById('toggle-debug-btn').style.display = 'none';
    
    window.logDebug('DMS experiment ready');
    
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('experiment-container').style.display = 'block';
    document.body.classList.add('experiment-running');
    
    window.logDebug('Requesting fullscreen...');
    const elem = document.documentElement;
    const fullscreenPromise = elem.requestFullscreen ? elem.requestFullscreen() 
        : elem.webkitRequestFullscreen ? elem.webkitRequestFullscreen()
        : elem.msRequestFullscreen ? elem.msRequestFullscreen()
        : Promise.reject('Fullscreen not supported');

    fullscreenPromise
        .then(() => {
            window.logDebug('Entered fullscreen');
            runTrial();
        })
        .catch(err => {
            window.logDebug('Fullscreen failed, starting anyway');
            runTrial();
        });
}

async function endExperiment() {
    window.logDebug('DMS Experiment ended');
    
    document.getElementById('experiment-container').style.display = 'none';
    document.getElementById('completion').style.display = 'block';
    document.body.classList.remove('experiment-running');
    
    // Show launch screen elements again
    document.getElementById('connection-status').style.display = 'block';
    document.getElementById('toggle-debug-btn').style.display = 'block';
    
    // Save data to Dropbox
    window.logDebug('Saving experiment data...');
    try {
        const dataPath = `/mkturkfolders/data/${subjectName}_dms_${new Date().getTime()}.json`;
        const dataStr = JSON.stringify(experimentData, null, 2);
        await dbx.filesUpload({
            path: dataPath,
            contents: dataStr,
            mode: { '.tag': 'add' }
        });
        window.logDebug('Data saved to Dropbox');
    } catch (error) {
        window.logDebug(`Error saving data: ${error.message}`);
    }
}
