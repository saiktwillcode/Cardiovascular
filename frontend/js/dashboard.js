/**
 * Clinical Intelligence Dashboard Controller
 * Multimodal AI Hackathon 2026 - Track A
 */

let viewer = null;
let currentFeatures = {};
let metadata = null;
let samplePatients = [];
let lastPredictionResult = null;
let currentExplanationTarget = 'CAD'; // 'CAD', 'LAD', 'LCX', 'RCA'
let autoRecalculate = true;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize 3D Viewer
    viewer = new Heart3DViewer('viewport-3d');
    viewer.onSelectVessel = (targetId) => {
        setExplanationTarget(targetId);
    };

    // 2. Load Metadata and Benchmark Cases
    try {
        metadata = await API.getMetadata();
        samplePatients = await API.getSamplePatients();
        
        setupPatientPresets();
        setupFeatureInputs();
        setupControls();
        setupMetricsModal();
        setupExerciseSimulator();

        // Load Case 1 by default
        if (samplePatients.length > 0) {
            loadPatientCase(0);
        } else {
            currentFeatures = { ...metadata.feature_defaults };
            runPrediction();
        }
    } catch (err) {
        console.error('Initialization error:', err);
        showToast('Error connecting to backend API: ' + err.message, 'error');
    }
});

function setupPatientPresets() {
    const container = document.getElementById('preset-patient-pills');
    if (!container) return;
    container.innerHTML = '';

    samplePatients.forEach((p, idx) => {
        const btn = document.createElement('button');
        btn.className = `preset-pill ${idx === 0 ? 'active' : ''}`;
        btn.innerHTML = `<span class="pill-id">${p.id}</span> <span class="pill-title">${p.name}</span>`;
        btn.onclick = () => {
            document.querySelectorAll('.preset-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadPatientCase(idx);
        };
        container.appendChild(btn);
    });
}

function loadPatientCase(index) {
    const p = samplePatients[index];
    if (!p) return;

    currentFeatures = { ...p.data };
    
    // Update patient vignette
    const infoBox = document.getElementById('patient-vignette');
    if (infoBox) {
        infoBox.innerHTML = `
            <div class="vignette-title">${p.id}: ${p.name}</div>
            <div class="vignette-desc">${p.clinical_profile}</div>
            <div class="vignette-gt">
                <span class="gt-tag">True CAD: ${p.ground_truth.CAD ? 'POSITIVE' : 'NEGATIVE'}</span>
                <span class="gt-tag">True LAD: ${p.ground_truth.LAD ? 'STENOTIC' : 'NORMAL'}</span>
                <span class="gt-tag">True LCX: ${p.ground_truth.LCX ? 'STENOTIC' : 'NORMAL'}</span>
                <span class="gt-tag">True RCA: ${p.ground_truth.RCA ? 'STENOTIC' : 'NORMAL'}</span>
            </div>
        `;
    }

    // Reset exercise results panel
    const rehabPanel = document.getElementById('rehab-results-panel');
    if (rehabPanel) rehabPanel.style.display = 'none';

    // Sync input form fields
    syncFormInputs();

    // Run prediction
    runPrediction();
}

function setupFeatureInputs() {
    const categories = {
        'Demographics & Vitals': [
            { key: 'Age', label: 'Age (Years)', min: 30, max: 85, step: 1, unit: 'yrs' },
            { key: 'Sex', label: 'Biological Sex', type: 'select', options: [{ label: 'Male', val: 1 }, { label: 'Female', val: 0 }] },
            { key: 'BMI', label: 'Body Mass Index', min: 18, max: 42, step: 0.1, unit: 'kg/m²' },
            { key: 'BP', label: 'Systolic Blood Pressure', min: 90, max: 200, step: 2, unit: 'mmHg' },
            { key: 'PR', label: 'Pulse Rate', min: 50, max: 130, step: 1, unit: 'bpm' }
        ],
        'Clinical Symptoms & History': [
            { key: 'Typical Chest Pain', label: 'Typical Angina', type: 'toggle' },
            { key: 'Dyspnea', label: 'Dyspnea (Shortness of breath)', type: 'toggle' },
            { key: 'DM', label: 'Diabetes Mellitus (DM)', type: 'toggle' },
            { key: 'HTN', label: 'Hypertension History', type: 'toggle' },
            { key: 'Current Smoker', label: 'Current Tobacco Smoker', type: 'toggle' },
            { key: 'FH', label: 'Family History of CAD', type: 'toggle' },
            { key: 'Function Class', label: 'NYHA Function Class', min: 0, max: 3, step: 1, unit: 'grade' }
        ],
        'ECG Biomarkers': [
            { key: 'St Elevation', label: 'ST-Segment Elevation', type: 'toggle', danger: true },
            { key: 'St Depression', label: 'ST-Segment Depression', type: 'toggle', danger: true },
            { key: 'Tinversion', label: 'T-Wave Inversion', type: 'toggle', danger: true },
            { key: 'Q Wave', label: 'Pathological Q Wave', type: 'toggle', danger: true },
            { key: 'LVH', label: 'Left Ventricular Hypertrophy (LVH)', type: 'toggle' },
            { key: 'Poor R Progression', label: 'Poor R-Wave Progression', type: 'toggle' },
            { key: 'BBB', label: 'Bundle Branch Block', type: 'select', options: [{ label: 'None', val: 0 }, { label: 'LBBB', val: 1 }, { label: 'RBBB', val: 2 }] }
        ],
        'Echo & Laboratory': [
            { key: 'EF-TTE', label: 'Ejection Fraction (EF-TTE)', min: 20, max: 70, step: 1, unit: '%' },
            { key: 'Region RWMA', label: 'Region with RWMA (Wall Motion Abnormality)', min: 0, max: 4, step: 1, unit: 'segments' },
            { key: 'LDL', label: 'LDL Cholesterol', min: 40, max: 260, step: 2, unit: 'mg/dL' },
            { key: 'HDL', label: 'HDL Cholesterol', min: 20, max: 80, step: 1, unit: 'mg/dL' },
            { key: 'TG', label: 'Triglycerides', min: 60, max: 450, step: 5, unit: 'mg/dL' },
            { key: 'FBS', label: 'Fasting Blood Sugar', min: 70, max: 300, step: 2, unit: 'mg/dL' },
            { key: 'CR', label: 'Serum Creatinine', min: 0.5, max: 2.8, step: 0.1, unit: 'mg/dL' },
            { key: 'ESR', label: 'Erythrocyte Sedimentation Rate (ESR)', min: 2, max: 85, step: 1, unit: 'mm/h' }
        ]
    };

    const container = document.getElementById('clinical-forms-accordion');
    if (!container) return;
    container.innerHTML = '';

    Object.entries(categories).forEach(([categoryTitle, fields]) => {
        const catCard = document.createElement('div');
        catCard.className = 'cat-card';

        const catHeader = document.createElement('div');
        catHeader.className = 'cat-header';
        catHeader.innerHTML = `<span>${categoryTitle}</span> <span class="cat-chevron">▼</span>`;
        catHeader.onclick = () => {
            catCard.classList.toggle('collapsed');
        };

        const catBody = document.createElement('div');
        catBody.className = 'cat-body';

        fields.forEach(f => {
            const row = document.createElement('div');
            row.className = 'feature-input-row';

            if (f.type === 'toggle') {
                row.innerHTML = `
                    <label class="feature-label">${f.label}</label>
                    <div class="toggle-switch-wrapper">
                        <label class="switch">
                            <input type="checkbox" id="input-${f.key}" data-key="${f.key}">
                            <span class="slider round ${f.danger ? 'danger-slider' : ''}"></span>
                        </label>
                        <span class="toggle-val-text" id="val-text-${f.key}">No</span>
                    </div>
                `;
            } else if (f.type === 'select') {
                const optHtml = f.options.map(o => `<option value="${o.val}">${o.label}</option>`).join('');
                row.innerHTML = `
                    <label class="feature-label">${f.label}</label>
                    <select id="input-${f.key}" data-key="${f.key}" class="medical-select">
                        ${optHtml}
                    </select>
                `;
            } else {
                row.innerHTML = `
                    <div class="slider-header">
                        <label class="feature-label">${f.label}</label>
                        <span class="feature-val-badge" id="val-text-${f.key}">0 ${f.unit || ''}</span>
                    </div>
                    <input type="range" class="medical-slider" id="input-${f.key}" data-key="${f.key}" 
                           min="${f.min}" max="${f.max}" step="${f.step}" value="${f.min}">
                `;
            }
            catBody.appendChild(row);
        });

        catCard.appendChild(catHeader);
        catCard.appendChild(catBody);
        container.appendChild(catCard);
    });

    container.querySelectorAll('input, select').forEach(elem => {
        elem.addEventListener('input', (e) => {
            const key = e.target.getAttribute('data-key');
            let val;
            if (e.target.type === 'checkbox') {
                val = e.target.checked ? 1 : 0;
                const txt = document.getElementById(`val-text-${key}`);
                if (txt) txt.textContent = val ? 'Yes' : 'No';
            } else {
                val = parseFloat(e.target.value);
                const txt = document.getElementById(`val-text-${key}`);
                if (txt) {
                    const unit = txt.textContent.split(' ')[1] || '';
                    txt.textContent = `${val} ${unit}`.trim();
                }
            }
            currentFeatures[key] = val;

            if (autoRecalculate) {
                debouncedPredict();
            }
        });
    });
}

function syncFormInputs() {
    Object.entries(currentFeatures).forEach(([key, val]) => {
        const input = document.getElementById(`input-${key}`);
        const txt = document.getElementById(`val-text-${key}`);
        if (!input) return;

        if (input.type === 'checkbox') {
            input.checked = (val == 1 || val === true || val === 'Y');
            if (txt) txt.textContent = input.checked ? 'Yes' : 'No';
        } else {
            input.value = val;
            if (txt) {
                const parts = txt.textContent.split(' ');
                const unit = parts.length > 1 ? parts[1] : '';
                txt.textContent = `${val} ${unit}`.trim();
            }
        }
    });
}

let debounceTimer = null;
function debouncedPredict() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        runPrediction();
    }, 250);
}

async function runPrediction() {
    try {
        const loadingIndicator = document.getElementById('calc-spinner');
        if (loadingIndicator) loadingIndicator.style.display = 'inline-block';

        const result = await API.predict(currentFeatures);
        lastPredictionResult = result;

        if (loadingIndicator) loadingIndicator.style.display = 'none';

        // 1. Update 3D Viewer Risk Colors & Flow
        const risks = {
            cad: result.targets.CAD.probability,
            lad: result.targets.LAD.probability,
            lcx: result.targets.LCX.probability,
            rca: result.targets.RCA.probability
        };
        viewer.updateVesselRisks(risks);

        // 2. Update Risk Cards & Dial
        updateRiskDashboard(result);

        // 3. Update Multi-Disease Pathology Suite
        updateMultiDiseaseGrid(result.extra_diseases);

        // 4. Update SHAP Waterfall
        renderShapAttributions();

    } catch (err) {
        console.error('Prediction failed:', err);
        showToast('Prediction failed: ' + err.message, 'error');
    }
}

function updateRiskDashboard(result) {
    const cad = result.targets.CAD;
    const lad = result.targets.LAD;
    const lcx = result.targets.LCX;
    const rca = result.targets.RCA;
    const summary = result.summary;

    // Overall CAD Gauge
    const cadPctElem = document.getElementById('overall-cad-pct');
    const cadStatusElem = document.getElementById('overall-cad-status');
    const cadBarElem = document.getElementById('overall-cad-bar');
    const syndromeElem = document.getElementById('vessel-syndrome-badge');

    if (cadPctElem) cadPctElem.textContent = `${cad.percentage}%`;
    if (cadStatusElem) {
        cadStatusElem.textContent = cad.category;
        cadStatusElem.style.color = cad.color;
    }
    if (cadBarElem) {
        cadBarElem.style.width = `${cad.percentage}%`;
        cadBarElem.style.backgroundColor = cad.color;
    }
    if (syndromeElem) {
        syndromeElem.textContent = summary.vessel_syndrome;
        syndromeElem.className = `syndrome-badge ${summary.stenotic_vessel_count > 0 ? 'syndrome-danger' : 'syndrome-normal'}`;
    }

    // Individual Target Vessel Cards
    const updateVesselCard = (id, target) => {
        const pctElem = document.getElementById(`${id.toLowerCase()}-pct`);
        const badgeElem = document.getElementById(`${id.toLowerCase()}-badge`);
        const barElem = document.getElementById(`${id.toLowerCase()}-bar`);
        const gradeElem = document.getElementById(`${id.toLowerCase()}-grade`);

        if (pctElem) pctElem.textContent = `${target.percentage}%`;
        if (badgeElem) {
            badgeElem.textContent = target.status.toUpperCase();
            badgeElem.style.backgroundColor = target.color;
        }
        if (barElem) {
            barElem.style.width = `${target.percentage}%`;
            barElem.style.backgroundColor = target.color;
        }
        if (gradeElem) {
            gradeElem.textContent = target.stenosis_grade;
        }
    };

    updateVesselCard('LAD', lad);
    updateVesselCard('LCX', lcx);
    updateVesselCard('RCA', rca);
}

function updateMultiDiseaseGrid(diseases) {
    const container = document.getElementById('multi-disease-grid');
    if (!container || !diseases) return;
    container.innerHTML = '';

    const iconMap = {
        stemi: '⚡',
        heart_failure: '💔',
        arrhythmia: '〰️',
        valvular: '🚪',
        lvh: '🛡️'
    };

    Object.entries(diseases).forEach(([key, d]) => {
        const card = document.createElement('div');
        card.className = 'disease-card';
        card.innerHTML = `
            <div class="disease-top">
                <span class="disease-icon">${iconMap[key] || '🩺'}</span>
                <span class="disease-pct" style="color: ${d.color};">${d.percentage}%</span>
            </div>
            <div class="disease-title">${d.name}</div>
            <div class="disease-badge" style="background: ${d.color}22; color: ${d.color}; border: 1px solid ${d.color}44;">
                ${d.category}
            </div>
            <div class="disease-desc">${d.desc}</div>
        `;
        container.appendChild(card);
    });
}

function setExplanationTarget(targetId) {
    currentExplanationTarget = targetId.toUpperCase();
    
    document.querySelectorAll('.shap-tab').forEach(tab => {
        if (tab.getAttribute('data-target') === currentExplanationTarget) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    renderShapAttributions();
}

function renderShapAttributions() {
    if (!lastPredictionResult) return;

    const targetData = lastPredictionResult.targets[currentExplanationTarget];
    if (!targetData) return;

    const container = document.getElementById('shap-bars-container');
    const targetTitle = document.getElementById('shap-target-title');
    if (!container) return;

    if (targetTitle) {
        const labels = {
            'CAD': 'Overall Coronary Artery Disease (CAD)',
            'LAD': 'LAD Artery Stenosis (Anterior Wall)',
            'LCX': 'LCX Artery Stenosis (Lateral Wall)',
            'RCA': 'RCA Artery Stenosis (Inferior Wall)'
        };
        targetTitle.textContent = labels[currentExplanationTarget] || currentExplanationTarget;
    }

    container.innerHTML = '';
    const drivers = targetData.top_drivers || [];

    if (drivers.length === 0) {
        container.innerHTML = `<div class="empty-msg">No feature attributions available for this model.</div>`;
        return;
    }

    const maxVal = Math.max(...drivers.map(d => Math.abs(d.shap_value)), 0.01);

    drivers.forEach(d => {
        const isElevating = d.shap_value > 0;
        const widthPct = Math.min((Math.abs(d.shap_value) / maxVal) * 100, 100);

        const row = document.createElement('div');
        row.className = 'shap-row';
        row.innerHTML = `
            <div class="shap-label">
                <span class="shap-name">${d.feature}</span>
                <span class="shap-val">val: ${d.value}</span>
            </div>
            <div class="shap-bar-track">
                <div class="shap-bar-center-line"></div>
                <div class="shap-bar ${isElevating ? 'shap-risk-up' : 'shap-risk-down'}" 
                     style="width: ${widthPct}%; ${isElevating ? 'left: 50%;' : 'right: 50%;'}">
                </div>
            </div>
            <div class="shap-impact ${isElevating ? 'text-danger' : 'text-success'}">
                ${isElevating ? '+' : ''}${d.shap_value.toFixed(3)}
            </div>
        `;
        container.appendChild(row);
    });
}

function setupExerciseSimulator() {
    const runBtn = document.getElementById('run-exercise-sim-btn');
    const typeSelect = document.getElementById('rehab-type-select');
    const weeksSlider = document.getElementById('rehab-weeks-slider');
    const weeksBadge = document.getElementById('rehab-weeks-badge');

    if (weeksSlider && weeksBadge) {
        weeksSlider.addEventListener('input', (e) => {
            weeksBadge.textContent = `${e.target.value} Weeks`;
        });
    }

    if (runBtn) {
        runBtn.onclick = async () => {
            try {
                runBtn.disabled = true;
                runBtn.innerHTML = `<span>⏳</span> Simulating Vascular Remodeling...`;

                const exType = typeSelect.value;
                const weeks = parseInt(weeksSlider.value, 10);

                const res = await API.simulateExercise(currentFeatures, exType, weeks);

                runBtn.disabled = false;
                runBtn.innerHTML = `<span>▶</span> Simulate Exercise Therapy`;

                // Display Results Panel
                const panel = document.getElementById('rehab-results-panel');
                panel.style.display = 'block';

                document.getElementById('rehab-risk-drop').textContent = `-${res.risk_impact.absolute_risk_reduction}%`;
                document.getElementById('rehab-collateral-note').textContent = 
                    `Angiogenesis Growth: +${res.exercise_program.angiogenesis_collateral_growth}% (Active Collaterals Sprouted)`;

                const deltasGrid = document.getElementById('rehab-deltas-grid');
                deltasGrid.innerHTML = `
                    <div class="delta-box">
                        <span class="delta-lbl">Blood Pressure</span>
                        <span class="delta-num">${res.physiological_changes.bp.before} → <strong>${res.physiological_changes.bp.after} mmHg</strong></span>
                        <span class="delta-sub text-success">${res.physiological_changes.bp.diff} mmHg</span>
                    </div>
                    <div class="delta-box">
                        <span class="delta-lbl">Resting Pulse</span>
                        <span class="delta-num">${res.physiological_changes.pr.before} → <strong>${res.physiological_changes.pr.after} bpm</strong></span>
                        <span class="delta-sub text-success">${res.physiological_changes.pr.diff} bpm</span>
                    </div>
                    <div class="delta-box">
                        <span class="delta-lbl">LDL Cholesterol</span>
                        <span class="delta-num">${res.physiological_changes.ldl.before} → <strong>${res.physiological_changes.ldl.after} mg/dL</strong></span>
                        <span class="delta-sub text-success">${res.physiological_changes.ldl.diff} mg/dL</span>
                    </div>
                    <div class="delta-box">
                        <span class="delta-lbl">Ejection Fraction</span>
                        <span class="delta-num">${res.physiological_changes.ef.before}% → <strong>${res.physiological_changes.ef.after}%</strong></span>
                        <span class="delta-sub text-success">+${res.physiological_changes.ef.diff}%</span>
                    </div>
                `;

                // Update 3D Heart with Sprouted Collateral Micro-Vessels & Decreased Stenosis Color
                const newRisks = {
                    cad: res.rehab_prediction.targets.CAD.probability,
                    lad: res.rehab_prediction.targets.LAD.probability,
                    lcx: res.rehab_prediction.targets.LCX.probability,
                    rca: res.rehab_prediction.targets.RCA.probability
                };
                viewer.updateVesselRisks(newRisks, true); // true = show collateral angiogenesis vessels!

                showToast(`Exercise Therapy Applied: CAD Risk reduced by ${res.risk_impact.absolute_risk_reduction}% with collateral angiogenesis!`, 'success');

            } catch (err) {
                console.error('Exercise simulation error:', err);
                runBtn.disabled = false;
                runBtn.innerHTML = `<span>▶</span> Simulate Exercise Therapy`;
                showToast('Exercise simulation failed: ' + err.message, 'error');
            }
        };
    }
}

function setupControls() {
    // Mode Switcher: Cardiac Twin vs Exercise Lab
    const modeHeartBtn = document.getElementById('mode-heart-btn');
    const modeExBtn = document.getElementById('mode-exercise-btn');
    const camBar = document.getElementById('camera-presets-bar');
    const exHud = document.getElementById('exercise-hud-overlay');

    if (modeHeartBtn && modeExBtn) {
        modeHeartBtn.onclick = () => {
            modeHeartBtn.classList.add('active');
            modeExBtn.classList.remove('active');
            viewer.setMode('heart');
            if (camBar) camBar.style.display = 'flex';
            if (exHud) exHud.style.display = 'none';
        };

        modeExBtn.onclick = () => {
            modeExBtn.classList.add('active');
            modeHeartBtn.classList.remove('active');
            viewer.setMode('exercise');
            if (camBar) camBar.style.display = 'none';
            if (exHud) exHud.style.display = 'block';
        };
    }

    // Exercise Selection in 3D HUD
    document.querySelectorAll('.ex-select-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.ex-select-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const ex = btn.getAttribute('data-ex');
            viewer.setExerciseType(ex);

            // Sync with rehab selector
            const typeSelect = document.getElementById('rehab-type-select');
            if (typeSelect) typeSelect.value = ex;
        };
    });

    // Theme Selector
    const themeSelect = document.getElementById('theme-selector');
    if (themeSelect) {
        themeSelect.onchange = (e) => {
            viewer.setTheme(e.target.value);
        };
    }

    // Sound Toggle
    const soundBtn = document.getElementById('toggle-sound-btn');
    if (soundBtn) {
        soundBtn.onclick = () => {
            const isEnabled = viewer.toggleSound();
            soundBtn.classList.toggle('active', isEnabled);
            soundBtn.innerHTML = isEnabled ? `<span class="tool-icon">🔊</span> Sound: ON` : `<span class="tool-icon">🔇</span> Sound: OFF`;
        };
    }

    // Camera Presets
    document.querySelectorAll('.cam-btn').forEach(btn => {
        btn.onclick = () => {
            const angle = btn.getAttribute('data-angle');
            viewer.setCameraPreset(angle);
        };
    });

    // 3D Toggles
    const torsoToggle = document.getElementById('toggle-torso-btn');
    if (torsoToggle) {
        torsoToggle.onclick = () => {
            torsoToggle.classList.toggle('active');
            viewer.toggleTorso();
        };
    }

    const pulseToggle = document.getElementById('toggle-pulse-btn');
    if (pulseToggle) {
        pulseToggle.onclick = () => {
            pulseToggle.classList.toggle('active');
            viewer.toggleHeartbeat();
        };
    }

    // SHAP Target Tabs
    document.querySelectorAll('.shap-tab').forEach(tab => {
        tab.onclick = () => {
            const t = tab.getAttribute('data-target');
            setExplanationTarget(t);
        };
    });

    // Recalculate button
    const recalcBtn = document.getElementById('recalculate-btn');
    if (recalcBtn) {
        recalcBtn.onclick = () => runPrediction();
    }
}

async function setupMetricsModal() {
    const modal = document.getElementById('metrics-modal');
    const openBtn = document.getElementById('view-metrics-btn');
    const closeBtn = document.getElementById('close-metrics-btn');

    if (openBtn && modal) {
        openBtn.onclick = async () => {
            modal.style.display = 'flex';
            await loadMetricsData();
        };
    }

    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}

async function loadMetricsData() {
    const content = document.getElementById('metrics-content-table');
    if (!content) return;

    try {
        const metrics = await API.getMetrics();
        let html = '';

        Object.entries(metrics).forEach(([target, info]) => {
            html += `
                <div class="metrics-target-block">
                    <div class="metrics-target-title">
                        <span>Target: <strong>${target}</strong></span>
                        <span class="selected-pill">Best Algorithm: ${info.best_model}</span>
                    </div>
                    <table class="medical-table">
                        <thead>
                            <tr>
                                <th>Algorithm</th>
                                <th>CV ROC-AUC</th>
                                <th>Test ROC-AUC</th>
                                <th>Accuracy</th>
                                <th>Precision</th>
                                <th>Recall</th>
                                <th>F1-Score</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            Object.entries(info.all_candidates).forEach(([algo, m]) => {
                const isSelected = algo === info.best_model;
                html += `
                    <tr class="${isSelected ? 'selected-algo-row' : ''}">
                        <td><strong>${algo}</strong> ${isSelected ? '★' : ''}</td>
                        <td>${m.cv_roc_auc_mean.toFixed(4)}</td>
                        <td><strong>${m.test_roc_auc.toFixed(4)}</strong></td>
                        <td>${(m.test_accuracy * 100).toFixed(1)}%</td>
                        <td>${(m.test_precision * 100).toFixed(1)}%</td>
                        <td>${(m.test_recall * 100).toFixed(1)}%</td>
                        <td>${m.test_f1.toFixed(4)}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });

        content.innerHTML = html;
    } catch (e) {
        content.innerHTML = `<div class="error-msg">Failed to load metrics: ${e.message}</div>`;
    }
}

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `medical-toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 3800);
}
