# risk-learning-experiment
Spatial reward task studying risk and learning behavior
Experiment Features:

✅ Single stimulus presentation (left, right, or center randomly)
✅ Correct response = tap stimulus, Incorrect = tap elsewhere or timeout
✅ All stimuli from both folders loaded and randomized (without replacement)
✅ Reshuffles and continues indefinitely
✅ Gamble logic with win/lose outcomes based on probability
✅ Outcome reveal (100ms blank → show corresponding sure stimulus)
✅ Reward feedback (sound plays n times)
✅ Black background during trials
✅ Data saves to Dropbox every 10 trials + at end

File Structure:

bash
Copy code
GitHub:
├── index.html
├── experiment.js (v18)
└── mkturk_*.js files

Dropbox:
└── /mkturkfolders/
    ├── /imagebags/
    │   ├── /sure_options/ (Sure1.png - Sure7.png)
    │   └── /gamble_options/ (Gamble7v1pw75.png, etc.)
    ├── /sounds/
    │   └── au0.wav
    └── /datafiles/
        └── /RiskLearningSubject/
