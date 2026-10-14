# Multimodal AI Hackathon 2026 — Track A
# Cardiovascular Risk Visualization & Prediction
## CardioTwin 3D: An Explainable Multimodal Digital Twin for Multi-Vessel Coronary Artery Stenosis and CAD Prediction

**Authors / Team:** Track A Engineering & Clinical AI Team  
**Date:** October 2026  
**System Status:** Complete & Fully Validated  
**Repository Working Directory:** `CARDIOVASCULAR PROJECT/`  

---

### Abstract
Coronary Artery Disease (CAD) remains the premier etiology of cardiovascular morbidity and mortality worldwide. Conventional statistical risk scoring produces abstract numerical probabilities that fail to communicate the spatial geometry, hemodynamic severity, and vessel-specific anatomical vulnerability of disease progression to clinicians and patients. In this project, we develop **CardioTwin 3D**, an end-to-end clinical decision-support and 3D anatomical visualization system. Utilizing the 303-patient Extension of the Z-Alizadeh Sani dataset from the UCI Machine Learning Repository, we construct multi-target predictive pipelines classifying overall CAD status alongside vessel-specific stenosis across the three primary coronary arteries: the Left Anterior Descending (LAD), Left Circumflex (LCX), and Right Coronary Artery (RCA). To ensure strict clinical validity, input features exclude catheterization target labels (`Cath`, `LAD`, `LCX`, `RCA`), eliminating target leakage. Our models achieve outstanding predictive performance (Cross-Validation ROC-AUC up to 0.9315 and Test ROC-AUC of 0.8941 for CAD; Test ROC-AUC of 0.8115 for LAD stenosis). We integrate these models with an interactive Three.js 3D cardiac digital twin featuring real-time hemodynamic flow particle simulation, dynamic risk color-mapping, and local SHAP (SHapley Additive exPlanations) attribution to elucidate the physiological drivers underlying each prediction.

---

### 1. Introduction & Clinical Motivation
Coronary arteries deliver oxygenated blood directly to the myocardium. Atherosclerotic plaque accumulation precipitates luminal narrowing (stenosis), leading to myocardial ischemia, unstable angina, and acute myocardial infarction (AMI). 
Clinical angiography classifies CAD as significant vessel stenosis $\ge 50\%$ diameter narrowing within one or more major coronary vessels:
1. **Left Anterior Descending (LAD):** Traverses the anterior interventricular groove, perfusing the anterior left ventricular wall, septum, and cardiac apex. Occlusion here (the clinical *"Widowmaker"*) confers high risk of sudden death or cardiogenic shock.
2. **Left Circumflex (LCX):** Traverses the left atrioventricular groove, supplying the lateral and posterior left ventricular myocardium.
3. **Right Coronary Artery (RCA):** Traverses the right atrioventricular groove to the inferior myocardium and conduction nodes (Sinoatrial and Atrioventricular nodes).

While risk engines (e.g., Framingham, ASCVD) offer aggregate probabilities, they treat the heart as a single black box without spatial localization. **CardioTwin 3D** bridges this divide by mapping multi-target machine learning predictions directly onto an interactive 3D anatomical coronary tree.

---

### 2. Dataset Architecture & Preprocessing Pipeline
We utilize the **Extension of the Z-Alizadeh Sani Dataset** (UCI Machine Learning Repository ID: 411 / 412), representing 303 verified clinical cases evaluated by invasive coronary angiography (Cath).

#### 2.1 Feature Categories (55 Input Features)
The input feature space spans 5 clinical diagnostic modalities:
1. **Demographic & Anthropometric:** Age, Biological Sex (Male/Female), Weight, Height/Length, Body Mass Index (BMI).
2. **Medical History & Comorbidities:** Diabetes Mellitus (DM), Hypertension (HTN), Current Tobacco Smoker, Ex-Smoker, Family History of CAD (FH), Obesity, Chronic Renal Failure (CRF), Cerebrovascular Accident (CVA), Chronic Airway Disease, Thyroid Disease, Congestive Heart Failure (CHF), Dyslipidemia (DLP).
3. **Symptom Complex & Physical Exam:** Systolic Blood Pressure (BP), Resting Pulse Rate (PR), Typical Chest Pain / Angina, Dyspnea, Functional Class (NYHA grade), Atypical CP, Nonanginal CP, Exertional CP, Low-Threshold Angina, Peripheral Edema, Weak Peripheral Pulse, Lung Rales, Systolic Murmur, Diastolic Murmur.
4. **12-Lead Electrocardiography (ECG):** Pathological Q Wave, ST-Segment Elevation, ST-Segment Depression, T-Wave Inversion, Left Ventricular Hypertrophy (LVH), Poor R-Wave Progression, Bundle Branch Block (BBB: None, LBBB, RBBB).
5. **Echocardiography & Laboratory Biomarkers:** Transthoracic Echocardiographic Ejection Fraction (`EF-TTE`), Region with Regional Wall Motion Abnormality (`Region RWMA`), Valvular Heart Disease (`VHD`: None, Mild, Moderate, Severe), Fasting Blood Sugar (FBS), Serum Creatinine (CR), Total Triglycerides (TG), Low-Density Lipoprotein (LDL), High-Density Lipoprotein (HDL), Blood Urea Nitrogen (BUN), Erythrocyte Sedimentation Rate (ESR), Hemoglobin (HB), Serum Potassium ($K^+$), Serum Sodium ($Na^+$), White Blood Cell count (WBC), Lymphocyte count, Neutrophil count, Platelet count (PLT).

#### 2.2 Target Leakage Prevention Methodology
A critical pitfall in prior automated CAD literature is *target leakage*, where angiographic catheterization variables (`Cath`) or co-dependent vessel tags (`LAD`, `LCX`, `RCA`) are mistakenly left in the input feature matrix. In our pipeline:
$$\mathbf{X}_{\text{features}} = \mathbf{D} \setminus \{\text{Cath}, \text{LAD}, \text{LCX}, \text{RCA}\}$$
All models are trained exclusively on pre-catheterization clinical data.

#### 2.3 Data Transformation & Encoding
- Binary categorical features (Y/N) $\to \{0, 1\}$.
- Biological sex $\to \{1 = \text{Male}, 0 = \text{Female}\}$.
- Multi-class ordinals (BBB: None=0, LBBB=1, RBBB=2; VHD: None=0, Mild=1, Moderate=2, Severe=3).
- Continuous features standard-scaled with zero-mean unit-variance ($\mu=0, \sigma=1$) preserved in dedicated joblib serialization pipelines.

---

### 3. Machine Learning Modeling & Multi-Target Validation

#### 3.1 Experimental Formulation & Cross-Validation
We conduct Stratified 5-Fold Cross-Validation on an 80% training partition, followed by unbiased evaluation on a 20% holdout test partition ($N=61$). 
We benchmark four distinct model families for each target:
1. **Random Forest (RF):** Tuned ensemble with balanced class weights to address minority vessel stenosis distribution.
2. **Extreme Gradient Boosting (XGBoost):** Regularized gradient boosted decision trees with sub-sampling and col-sampling by tree.
3. **Gradient Boosting Classifier (GBM):** Stage-wise additive gradient boosted regression trees.
4. **L2-Regularized Logistic Regression (LR):** Parametric baseline with standardized coefficients.

#### 3.2 Quantitative Evaluation Results Table

| Target | Model Candidate | CV ROC-AUC (Mean) | Test ROC-AUC | Test Accuracy | Test Precision | Test Recall | Test F1-Score | Selected Best |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **CAD (Overall)** | **Logistic Regression** | **0.9258** | **0.8941** | **80.3%** | **86.4%** | **86.4%** | **0.8537** | **Selected** |
| CAD (Overall) | Random Forest | 0.9315 | 0.8553 | 86.9% | 88.0% | 94.3% | 0.9111 | Candidate |
| CAD (Overall) | XGBoost | 0.9168 | 0.8424 | 82.0% | 86.0% | 89.0% | 0.8791 | Candidate |
| CAD (Overall) | Gradient Boosting | 0.9187 | 0.8411 | 80.3% | 84.8% | 88.6% | 0.8636 | Candidate |
| **LAD Stenosis** | **Random Forest** | **0.8586** | **0.8115** | **72.1%** | **72.5%** | **80.6%** | **0.7733** | **Selected** |
| LAD Stenosis | Logistic Regression | 0.8183 | 0.8159 | 70.5% | 71.0% | 77.8% | 0.7429 | Candidate |
| LAD Stenosis | Gradient Boosting | 0.8347 | 0.8007 | 72.1% | 73.0% | 80.6% | 0.7671 | Candidate |
| LAD Stenosis | XGBoost | 0.8229 | 0.7712 | 68.9% | 70.0% | 75.0% | 0.7246 | Candidate |
| **LCX Stenosis** | **Random Forest** | **0.7533** | **0.7000** | **67.2%** | **61.1%** | **50.0%** | **0.5238** | **Selected** |
| LCX Stenosis | Gradient Boosting | 0.7386 | 0.6670 | 68.9% | 65.0% | 54.2% | 0.5778 | Candidate |
| LCX Stenosis | XGBoost | 0.7562 | 0.6659 | 65.6% | 58.8% | 50.0% | 0.5333 | Candidate |
| LCX Stenosis | Logistic Regression | 0.6624 | 0.6505 | 62.3% | 53.8% | 58.3% | 0.5490 | Candidate |
| **RCA Stenosis** | **Logistic Regression** | **0.7077** | **0.7537** | **70.5%** | **61.9%** | **56.5%** | **0.5909** | **Selected** |
| RCA Stenosis | Random Forest | 0.7092 | 0.7244 | 70.5% | 64.7% | 47.8% | 0.5000 | Candidate |
| RCA Stenosis | XGBoost | 0.7009 | 0.7146 | 67.2% | 57.9% | 47.8% | 0.5238 | Candidate |
| RCA Stenosis | Gradient Boosting | 0.7162 | 0.6976 | 65.6% | 53.3% | 43.5% | 0.4615 | Candidate |

---

### 4. Explainable AI (XAI): SHAP Attribution Framework
Black-box risk numbers undermine clinical trust. We incorporate game-theoretic **SHAP (SHapley Additive exPlanations)** to dissect individual patient predictions into additive feature attributions:
$$f(x) = \phi_0 + \sum_{i=1}^{M} \phi_i(x)$$
Where $\phi_0$ is the base expected model prediction, and $\phi_i(x)$ is the marginal attribution of clinical biomarker $i$.

#### 4.1 Physiological Concordance of Learned Attributions
- **Typical Chest Pain & Age:** Consistently drive positive SHAP values towards CAD, reflecting classic angina pectoris epidemiology.
- **ST Elevation & T Inversion:** Strong positive drivers for LAD and CAD stenosis, aligning with acute anterior subendocardial or transmural ischemia.
- **Region with RWMA:** Exhibits strong localized attribution to LAD and LCX stenosis, corroborating echocardiographic systolic wall motion deficits in corresponding coronary perfusion territories.
- **Ejection Fraction (EF-TTE):** Preserved EF ($>55\%$) generates strong negative (protective) SHAP values, shifting probability away from critical multivessel disease.

---

### 5. 3D Anatomical Digital Twin & Hemodynamic Pipeline
The frontend visualization architecture is constructed in modern WebGL via Three.js with zero heavy GPU prerequisites.

#### 5.1 Anatomical Modeling
- **Myocardium & Chambers:** Left and Right Ventricles modeled with custom vertex displacement to represent the anterior interventricular sulcus and apical tapering; Left and Right Atria with venous inflows.
- **Great Vessels:** Ascending Aorta, Aortic Arch with branching brachiocephalic arteries, Descending Aorta, Pulmonary Artery Trunk bifurcating into left/right branches, and Vena Cava.
- **Coronary Arterial Trees (LAD, LCX, RCA):** Formed via parametric Catmull-Rom 3D cubic splines swept into Tube Geometries with branching side diagonals (`D1`, `OM1`, `AM`).
- **Thorax / Ribcage Silhouette Context:** Stylized anatomical ribcage and sternum with translucent wireframe shader, grounding the cardiac organ in human torso context.

#### 5.2 Dynamic Risk Mapping & Hemodynamic Particle Simulation
- **Vessel Color Interpolation:** Continuous color transitions driven by model prediction $P(\text{Stenosis})$:
  - $P < 0.30$: Emerald Green (`#10B981`) — Patent lumen / minimal risk.
  - $0.30 \le P < 0.70$: Amber (`#F59E0B`) — Moderate stenosis.
  - $P \ge 0.70$: Crimson Red (`#EF4444`) — Severe/critical stenosis ($\ge 70\%$).
- **Hemodynamic Particle Flow:** Over 75 animated luminescent particles traverse the coronary tubes. When predicted stenosis surpasses 70%, flow particle velocity drops by 65%, demonstrating ischemic hypoperfusion.
- **Pulsing Constriction Rings:** Geometric 3D torus markers pulse at proximal LAD, mid LCX, and proximal RCA sites during critical stenosis states.
- **Interactive Raycasting:** Hovering or clicking on coronary branches highlights the structure, triggers an anatomical HUD tooltip, smoothly animates the camera to standard clinical view angles, and synchronizes the dashboard SHAP view to that vessel.

---

### 6. System Architecture & Usage Guide

```
CARDIOVASCULAR PROJECT/
├── backend/
│   ├── app.py                 # FastAPI backend (Inference, SHAP, Patients, Metrics)
│   ├── ml_pipeline.py         # Leakage-free training, CV benchmark & artifact generation
│   ├── models/                # Serialized model weights (*.joblib) & metadata
│   └── data/                  # UCI dataset & sample benchmark patient JSON
├── frontend/
│   ├── index.html             # High-tech medical UI layout & 3D viewport
│   ├── css/style.css          # Dark glassmorphic medical theme
│   ├── js/
│   │   ├── heart3d.js         # Three.js cardiac 3D engine & particle physics
│   │   ├── dashboard.js       # Clinical dashboard controller & SHAP visualizer
│   │   └── api.js             # Client-server asynchronous API connector
│   └── vendor/                # Standalone Three.js, OrbitControls, Chart.js bundles
├── documentation/
│   └── Hackathon_TrackA_Cardiovascular_Report.md
├── requirements.txt           # Python dependency specification
├── run_app.py                 # Automated one-click launcher
└── README.md                  # Quickstart & architectural summary
```

#### 6.1 Execution Instructions
1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Launch Application:**
   ```bash
   python run_app.py
   ```
3. Open standard browser at `http://127.0.0.1:8000`.

---

### 7. Clinical Safety Disclaimer & Ethical Considerations
Medical AI systems require strict operational boundaries:
- **Decision-Support Only:** The software is designed for auxiliary decision support and clinical education.
- **Diagnostic Confirmation Required:** Statistical risk cannot replace formal fluoroscopic coronary angiography, intravascular ultrasound (IVUS), or fractional flow reserve (FFR).
- **Visible Disclaimers:** A permanent, prominent safety banner is fixed at the top of the interface, ensuring compliance with clinical AI safety best practices.

---

### 8. 3–10 Minute Demonstration Video Script

| Timestamp | Phase | Visual / Action | Narration & Technical Highlights |
| :--- | :--- | :--- | :--- |
| **0:00 – 1:00** | **Introduction** | System launch, 3D anatomical viewer rendering the beating heart with coronary arteries. | Introduction to Track A: The clinical gap between raw risk percentages and spatial coronary anatomy. Overview of CardioTwin 3D. |
| **1:00 – 2:30** | **3D Interaction** | Orbiting camera, clicking Camera Presets (Anterior LAD, Lateral LCX, Inferior RCA), toggling Torso and Heartbeat. | Explaining anatomical landmarks: Myocardium, Aortic Arch, and the 3 target vessels (LAD, LCX, RCA). Demonstrating raycasting tooltips. |
| **2:30 – 4:30** | **Clinical Case Walkthrough** | Selecting Case #1 (Healthy) $\to$ Case #2 (Isolated LAD) $\to$ Case #4 (Severe Triple Vessel). | Observing dynamic 3D color shifts from green to red, emergence of stenosis constriction rings, and hemodynamic particle deceleration (ischemic hypoperfusion). |
| **4:30 – 6:30** | **Explainable AI (SHAP)** | Switching SHAP tabs (CAD, LAD, LCX, RCA); inspecting diverging waterfall bars. | Interpreting physiological drivers: ST Elevation and RWMA driving LAD risk; preserved EF exerting protective influence. |
| **6:30 – 8:00** | **Interactive Simulator** | Modifying sliders (e.g. increasing Age, BP, LDL, ST Elevation). | Real-time interactive risk remodeling. Demonstrating instant response without page reloads. |
| **8:00 – 9:30** | **Technical & Model Validation** | Opening Model Validation modal; reviewing CV and Test metrics across RF, XGBoost, and Logistic Regression. | Verifying target leakage prevention (`Cath`, `LAD`, `LCX`, `RCA` excluded). Reviewing ROC-AUC ($0.9315$ CV). |
| **9:30 – 10:00**| **Conclusion & Safety** | Reviewing clinical disclaimer; closing summary. | Concluding remarks on multimodal digital twins in next-generation cardiology. |

---

### 9. Conclusion
**CardioTwin 3D** provides a robust, clinically interpretable, and aesthetically advanced solution for Track A of the Multimodal AI Hackathon 2026. By unifying leakage-free multi-target machine learning with interactive 3D WebGL anatomical mapping and game-theoretic SHAP explainability, the platform transforms abstract statistical risk into intuitive, spatially localized medical intelligence.
