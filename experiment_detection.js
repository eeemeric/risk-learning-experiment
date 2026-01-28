// ========================================
// DETECTION EXPERIMENT - SINGLE STIMULUS
// Subject taps stimulus when it appears
// ========================================

console.log("EXPERIMENT_DETECTION.JS LOADED - VERSION 42 - " + new Date());

// Global variables
let currentTrial = 0;
let totalTrials = 0;
let experimentData = [];
let params = {};
let subjectName = "";
let loadedImages = { sure: [], gamble: [] };
let trialOrder = [];
let currentBlock = 1;
let trialWithinBlock = 0;
// BLE device reference (from mkturk_bluetooth.js)
let ble = null;

// ========================================
// TRIAL ORDER GENERATION
// ========================================

function generateTrialOrder() {
    trialOrder = shuffleArray(trialOrder);
    totalTrials = trialOrder.length;
    console.log("Generated trial order with " + totalTrials + " trials");
}

// ========================================
// LOAD ASSETS FROM DROPBOX
// ========================================

async function loadImageFromDropboxCustom(imagePath) {
    try {
        console.log("Loading image from:", imagePath);
        const response = await dbx.filesDownload({ path: imagePath });
        const blob = response.result.fileBlob;
        const imageUrl = window.URL.createObjectURL(blob);
        
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = function() {
                console.log("Image loaded:", imagePath);
                resolve(image);
            };
            image.onerror = function() {
                reject(new Error("Image load failed"));
            };
            image.src = imageUrl;
        });
    } catch (error) {
        console.error("Error loading image:", error);
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
        console.error("Error getting folder contents:", error);
        return [];
    }
}

async function loadRewardSound() {
    try {
        const soundPath = "/mkturkfolders/sounds/au0.wav";
        const response = await dbx.filesDownload({ path: soundPath });
        const blob = response.result.fileBlob;
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audiocontext.decodeAudioData(arrayBuffer);
        sounds.buffer[0] = audioBuffer;
        console.log("Audio loaded");
    } catch (error) {
        console.error("Error loading audio:", error);
    }
}

async function loadAssetsFromDropbox() {
    console.log("Loading assets...");
    
    try {
        // Try to load from cache first
        if (!isOnline) {
            console.log("Offline mode - loading from cache");
            const cachedSure = getCachedImages(CACHE_KEYS.SURE_IMAGES);
            const cachedGamble = getCachedImages(CACHE_KEYS.GAMBLE_IMAGES);
            
            if (cachedSure && cachedGamble) {
                loadedImages.sure = cachedSure;
                loadedImages.gamble = cachedGamble;
                console.log("Loaded from cache successfully");
                generateTrialCombinations();
                return;
            } else {
                alert("No cached data available. Please connect to internet first.");
                return;
            }
        }
        
        // Online - load from Dropbox and cache
        const sureImagePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/sure_options");
        console.log("Sure options found:", sureImagePaths.length);
        
        for (const path of sureImagePaths) {
            const image = await loadImageFromDropboxCustom(path);
            loadedImages.sure.push({
                image: image,
                path: path,
                type: 'sure'
            });
        }
        
        const gambleImagePaths = await getDropboxFolderContents("/mkturkfolders/imagebags/gamble_options");
        console.log("Gamble options found:", gambleImagePaths.length);
        
        for (const path of gambleImagePaths) {
            const image = await loadImageFromDropboxCustom(path);
            loadedImages.gamble.push({
                image: image,
                path: path,
                type: 'gamble'
            });
        }
        
        console.log("Total images loaded:", loadedImages.sure.length + loadedImages.gamble.length);
        
        // Cache the images
        cacheImages(CACHE_KEYS.SURE_IMAGES, loadedImages.sure);
        cacheImages(CACHE_KEYS.GAMBLE_IMAGES, loadedImages.gamble);
        
        generateTrialCombinations();
        await loadRewardSound();
        
    } catch (error) {
        console.error("Error loading assets:", error);
        alert("Failed to load assets. Check internet connection.");
    }
}

// ========================================
// GENERATE TRIAL COMBINATIONS
// ========================================

function generateTrialCombinations() {
    trialOrder = [];
    
    // Create array of indices for all loaded images
    const totalImages = loadedImages.sure.length + loadedImages.gamble.length;
    trialOrder = shuffleArray([...Array(totalImages).keys()]);
    totalTrials = trialOrder.length;
    
    console.log("Generated trial order with " + totalTrials + " stimuli");
}

function getStimulusAtIndex(index) {
    const allStimuli = [...loadedImages.sure, ...loadedImages.gamble];
    return allStimuli[index];
}

// ========================================
// LOAD SUBJECT PARAMETERS
// ========================================

async function loadSubjectParameters(subject) {
    console.log("Loading parameters for subject: " + subject);
    logDebug("Loading parameters for subject: " + subject);
    
    try {
        // Try cache first
        if (!isOnline) {
            console.log("Offline - loading parameters from cache");
            const cached = getCachedParameters(subject);
            if (cached) {
                params = cached;
                console.log("Parameters loaded from cache");
                logDebug("Parameters loaded from cache");
                return true;
            } else {
                alert("No cached parameters for this subject. Please connect to internet first.");
                return false;
            }
        }
        
        // Online - load from Dropbox
        const paramPath = `/mkturkfolders/parameterfiles/subjects/${subject}_params.txt`;
        logDebug(`Attempting to load: ${paramPath}`);
        
        const response = await dbx.filesDownload({ path: paramPath });
        logDebug(`File download successful`);
        
        const blob = response.result.fileBlob;
        const text = await blob.text();
        params = JSON.parse(text);
        
        // Cache parameters
        cacheParameters(subject, params);
        
        console.log("Parameters loaded:", params);
        logDebug("Parameters loaded successfully!");
        return true;
        
    } catch (error) {
        logDebug(`Error loading parameters: ${error.message}`);
        console.error("Error loading parameters:", error);
        return false;
    }
}

// ========================================
// SAVE DATA TO DROPBOX
// ========================================

async function saveDataToDropbox() {
    console.log("Attempting to save data...");
    
    // If offline, save to local storage instead
    if (!isOnline) {
        console.log("Offline - saving to local storage");
        saveDataLocally(subjectName, "detection", params, experimentData, currentTrial, currentBlock);
        return;
    }
    
    try {
        const subject = subjectName || "UnknownSubject";
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const filename = `/mkturkfolders/datafiles/${subject}/${subject}_detection_${timestamp}.json`;
        
        const dataToSave = {
            experimentInfo: {
                experimentType: "detection",
                subject: subject,
                parameters: params,
                startTime: experimentData[0]?.timestamp || now.toISOString(),
                endTime: now.toISOString(),
                totalTrials: currentTrial,
                totalBlocks: currentBlock,
                version: "42"
            },
            trials: experimentData
        };
        
        const dataString = JSON.stringify(dataToSave, null, 2);
        
        const response = await dbx.filesUpload({
            path: filename,
            contents: dataString,
            mode: { '.tag': 'overwrite' }
        });
        
        console.log("Data saved to Dropbox:", filename);
        
    } catch (error) {
        console.error("Error saving to Dropbox:", error);
        console.log("Falling back to local storage");
        saveDataLocally(subjectName, "detection", params, experimentData, currentTrial, currentBlock);
    }
}

// ========================================
// SINGLE STIMULUS PRESENTATION
// ========================================

async function presentSingleStimulus(image, imagePath) {
    return new Promise((resolve) => {
        clearDisplay();
        
        const position = Math.random() > 0.5 ? 'left' : 'right';
        const stimulus = showStimulus(image, position);
        
        let responseMade = false;
        
        const handleStimulusClick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!responseMade) {
                responseMade = true;
                hideStimulus(stimulus);
                document.getElementById('experiment-container').removeEventListener('click', handleBackgroundClick);
                resolve({ correct: true, position: position, imagePath: imagePath });
            }
        };
        
        const handleBackgroundClick = () => {
            if (!responseMade) {
                responseMade = true;
                hideStimulus(stimulus);
                stimulus.removeEventListener('click', handleStimulusClick);
                resolve({ correct: false, position: position, imagePath: imagePath });
            }
        };
        
        stimulus.addEventListener('click', handleStimulusClick, { passive: false });
        document.getElementById('experiment-container').addEventListener('click', handleBackgroundClick);
        
        setTimeout(() => {
            if (!responseMade) {
                responseMade = true;
                hideStimulus(stimulus);
                stimulus.removeEventListener('click', handleStimulusClick);
                document.getElementById('experiment-container').removeEventListener('click', handleBackgroundClick);
                resolve({ correct: false, position: position, imagePath: imagePath, timeout: true });
            }
        }, params.ChoiceTimeOut || 10000);
    });
}

// ========================================
// TRIAL MANAGEMENT
// ========================================

async function runTrial() {
    console.log(`Starting trial ${currentTrial + 1} (Block ${currentBlock}, Trial ${trialWithinBlock + 1} of ${totalTrials})`);
    logDebug(`Trial ${currentTrial + 1} starting`);
    
    const stimulusIndex = trialOrder[trialWithinBlock];
    logDebug(`Stimulus index: ${stimulusIndex}`);
    
    const stimulusData = getStimulusAtIndex(stimulusIndex);
    console.log(`Presenting: ${stimulusData.path} (${stimulusData.type})`);
    logDebug(`Stimulus: ${stimulusData.path}`);
    
    const response = await presentSingleStimulus(
        stimulusData.image, 
        stimulusData.path
    );
    logDebug(`Response received: correct=${response.correct}`);

    // Determine reward
    logDebug(`Determining reward...`);
    let rewardResult = { rewardCount: 0, outcome: 'none' };
    
    // Process response
    if (response.correct) {
        console.log('Correct response!');
        
        rewardResult = determineRewardCount(stimulusData.path, stimulusData.type);
        logDebug(`Reward determined: ${rewardResult.rewardCount}`);

        logDebug(`Calling showOutcomeAndDeliverReward...`);
        await showOutcomeAndDeliverReward(rewardResult.rewardCount, response.position, loadedImages, params, ble);
        logDebug(`showOutcomeAndDeliverReward returned`);
    } else {
        logDebug(`Incorrect response or timeout`);
        console.log('Incorrect response or timeout');
    }
    logDebug(`Saving trial data...`);
    experimentData.push({
        trial: currentTrial + 1,
        block: currentBlock,
        trialWithinBlock: trialWithinBlock + 1,
        stimulus: stimulusData.path,
        stimulusType: stimulusData.type,
        position: response.position,
        correct: response.correct,
        timeout: response.timeout || false,
        rewardCount: rewardResult.rewardCount,
        gambleOutcome: rewardResult.outcome,
        gambleWinAmount: rewardResult.winAmount,
        gambleLoseAmount: rewardResult.loseAmount,
        gambleProbability: rewardResult.probability,
        timestamp: new Date().toISOString()
    });
    
    if ((currentTrial + 1) % 10 === 0) {
        console.log("Triggering backup save at trial", currentTrial + 1);
        await saveDataToDropbox();
    }
    
    await new Promise(resolve => setTimeout(resolve, params.InterTrialInterval || 1000));
    
    currentTrial++;
    trialWithinBlock++;
    
    if (trialWithinBlock >= totalTrials) {
        console.log(`Block ${currentBlock} complete. Reshuffling...`);
        trialOrder = shuffleArray([...Array(loadedImages.sure.length + loadedImages.gamble.length).keys()]);
        trialWithinBlock = 0;
        currentBlock++;
    }
    
    runTrial();
}

// ========================================
// DETERMINE REWARD
// ========================================

function determineRewardCount(imagePath, stimulusType) {
    if (stimulusType === 'sure') {
        const rewardCount = getSureRewardValue(imagePath);
        return {
            rewardCount: rewardCount,
            outcome: 'sure',
            winAmount: null,
            loseAmount: null,
            probability: null
        };
    } else if (stimulusType === 'gamble') {
        const gambleOutcome = getGambleOutcome(imagePath);
        return {
            rewardCount: gambleOutcome.rewardAmount,
            outcome: gambleOutcome.outcome,
            winAmount: gambleOutcome.winAmount,
            loseAmount: gambleOutcome.loseAmount,
            probability: gambleOutcome.winProbability
        };
    }
    return { rewardCount: 0, outcome: 'unknown' };
}

// ========================================
// EXPERIMENT CONTROL
// ========================================

async function startExperiment() {
    console.log('Starting Experiment...');
    logDebug('Starting Experiment...');
    
    // Check token first
    const token = localStorage.getItem('dropbox_access_token');
    if (token) {
        logDebug(`Token found: ${token.substring(0, 20)}...`);
    } else {
        logDebug(`NO TOKEN IN LOCALSTORAGE`);
        alert('No Dropbox token found. Please refresh and authorize.');
        return;
    }
    
    const subjectSelect = document.getElementById('subject-select');
    subjectName = subjectSelect.value;
    
    if (!subjectName) {
        alert('Please select a subject first!');
        return;
    }
    
    logDebug('Loading parameters...');
    const paramsLoaded = await loadSubjectParameters(subjectName);
    if (!paramsLoaded) {
        alert('Failed to load subject parameters.');
        return;
    }
    logDebug('Parameters loaded!');
    
    logDebug('Initializing audio...');
    initializeAudio();
    logDebug('Audio initialized!');
    
    logDebug('Loading assets from Dropbox...');
    await loadAssetsFromDropbox();
    logDebug('Assets loaded!');
    
    // Hide launch screen elements
    document.getElementById('connection-status').style.display = 'none';
    document.getElementById('toggle-debug-btn').style.display = 'none';
    
    logDebug(`Experiment ready: ${totalTrials} trials`);
    
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('experiment-container').style.display = 'block';
    document.body.classList.add('experiment-running');
    
    logDebug('Requesting fullscreen...');
    const elem = document.documentElement;
    const fullscreenPromise = elem.requestFullscreen ? elem.requestFullscreen() 
        : elem.webkitRequestFullscreen ? elem.webkitRequestFullscreen()
        : elem.msRequestFullscreen ? elem.msRequestFullscreen()
        : Promise.reject('Fullscreen not supported');

    fullscreenPromise
        .then(() => {
            logDebug('Entered fullscreen');
            runTrial();
        })
        .catch(err => {
            logDebug('Fullscreen failed, starting anyway');
            runTrial();
        });
}

async function endExperiment() {
    console.log('Experiment complete!');
    await saveDataToDropbox();
    document.body.classList.remove('experiment-running');
    document.getElementById('experiment-container').style.display = 'none';
    document.getElementById('completion').style.display = 'block';
    
    exitFullscreen();
    // Show launch screen elements again
    document.getElementById('connection-status').style.display = 'block';
    document.getElementById('toggle-debug-btn').style.display = 'block';
}
