"""
FastAPI Clinical Backend for Cardiovascular Risk & Multi-Vessel Stenosis Prediction
Multimodal AI Hackathon 2026 - Track A
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")

app = FastAPI(
    title="Cardiovascular Risk & 3D Stenosis Prediction API",
    description="Backend API for predicting overall CAD and multi-vessel (LAD, LCX, RCA) stenosis with SHAP explanations.",
    version="1.0.0"
)

# Enable CORS for local testing and web browsers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Models, Scaler, Explainers, and Metadata
models = {}
explainers = {}
scaler = None
metadata = {}
sample_patients = []

def load_artifacts():
    global models, explainers, scaler, metadata, sample_patients
    targets = ["cad", "lad", "lcx", "rca"]
    for t in targets:
        model_file = os.path.join(MODEL_DIR, f"{t}_model.joblib")
        if os.path.exists(model_file):
            models[t] = joblib.load(model_file)
            
        exp_file = os.path.join(MODEL_DIR, f"{t}_explainer.joblib")
        if os.path.exists(exp_file):
            explainers[t] = joblib.load(exp_file)
            
    scaler_file = os.path.join(MODEL_DIR, "scaler.joblib")
    if os.path.exists(scaler_file):
        scaler = joblib.load(scaler_file)
        
    meta_file = os.path.join(MODEL_DIR, "metadata.json")
    if os.path.exists(meta_file):
        with open(meta_file, "r") as f:
            metadata = json.load(f)
            
    patients_file = os.path.join(DATA_DIR, "sample_patients.json")
    if os.path.exists(patients_file):
        with open(patients_file, "r") as f:
            sample_patients = json.load(f)
            
load_artifacts()

class PatientInput(BaseModel):
    features: Dict[str, Any]

def format_feature_input(raw_input: Dict[str, Any]) -> pd.DataFrame:
    feature_names = metadata.get("features", [])
    defaults = metadata.get("feature_defaults", {})
    
    clean_dict = {}
    for f in feature_names:
        if f in raw_input:
            val = raw_input[f]
            # Handle text conversions if passed
            if isinstance(val, str):
                val_clean = val.strip().lower()
                if val_clean in ['y', 'yes', 'true', '1']:
                    clean_dict[f] = 1
                elif val_clean in ['n', 'no', 'false', '0']:
                    clean_dict[f] = 0
                elif val_clean in ['male', 'm']:
                    clean_dict[f] = 1
                elif val_clean in ['female', 'fmale', 'f']:
                    clean_dict[f] = 0
                elif val_clean == 'mild':
                    clean_dict[f] = 1
                elif val_clean == 'moderate':
                    clean_dict[f] = 2
                elif val_clean == 'severe':
                    clean_dict[f] = 3
                elif val_clean == 'lbbb':
                    clean_dict[f] = 1
                elif val_clean == 'rbbb':
                    clean_dict[f] = 2
                else:
                    try:
                        clean_dict[f] = float(val)
                    except:
                        clean_dict[f] = defaults.get(f, 0)
            else:
                try:
                    clean_dict[f] = float(val)
                except:
                    clean_dict[f] = defaults.get(f, 0)
        else:
            clean_dict[f] = defaults.get(f, 0)
            
    return pd.DataFrame([clean_dict])[feature_names]

def compute_single_shap(explainer, model, sample_df, feature_names):
    try:
        # Check if explainer is LinearExplainer
        exp_type = type(explainer).__name__
        if "Linear" in exp_type:
            sample_scaled = scaler.transform(sample_df)
            shap_vals = explainer.shap_values(sample_scaled)
        else:
            shap_vals = explainer.shap_values(sample_df)
            
        if isinstance(shap_vals, list):
            # Binary classification list: [class_0, class_1]
            raw_contribs = np.array(shap_vals[1])[0]
        elif isinstance(shap_vals, np.ndarray):
            if shap_vals.ndim == 3:
                # Shape (1, n_features, 2)
                raw_contribs = shap_vals[0, :, 1]
            elif shap_vals.ndim == 2:
                raw_contribs = shap_vals[0]
            else:
                raw_contribs = shap_vals
        else:
            raw_contribs = np.zeros(len(feature_names))
            
        # Pair with feature names and values
        explanations = []
        for feat, val, contrib in zip(feature_names, sample_df.iloc[0].values, raw_contribs):
            explanations.append({
                "feature": feat,
                "value": float(val),
                "shap_value": round(float(contrib), 4),
                "impact": "elevating_risk" if contrib > 0 else "protective"
            })
            
        # Sort by absolute SHAP impact
        explanations.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        return explanations
    except Exception as e:
        print(f"SHAP error: {e}")
        return []

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "models_loaded": list(models.keys()),
        "total_features": len(metadata.get("features", [])),
        "dataset_patients": 303,
        "leakage_prevention": "Strictly excluded Cath, LAD, LCX, RCA from input space."
    }

@app.get("/api/metadata")
def get_metadata():
    return metadata

@app.get("/api/patients")
def get_patients():
    return sample_patients

@app.get("/api/metrics")
def get_metrics():
    metrics_file = os.path.join(MODEL_DIR, "metrics_summary.json")
    if os.path.exists(metrics_file):
        with open(metrics_file, "r") as f:
            return json.load(f)
    return metadata.get("metrics_summary", {})

@app.post("/api/predict")
def predict_cardiac_risk(payload: PatientInput):
    feature_names = metadata.get("features", [])
    if not feature_names:
        raise HTTPException(status_code=500, detail="Model metadata not loaded.")
        
    sample_df = format_feature_input(payload.features)
    sample_scaled = scaler.transform(sample_df) if scaler else sample_df
    
    results = {}
    vessels = ["cad", "lad", "lcx", "rca"]
    
    for v in vessels:
        model = models.get(v)
        if not model:
            continue
            
        # Determine whether to use scaled features
        model_name = type(model).__name__
        use_scaled = ("Logistic" in model_name)
        inp = sample_scaled if use_scaled else sample_df
        
        prob = float(model.predict_proba(inp)[0, 1])
        prediction = int(prob >= 0.5)
        
        # Determine risk category & color
        if prob < 0.30:
            category = "Low Risk / Normal"
            color = "#10B981" # Green
            stenosis_grade = "<30% (Minimal/None)"
        elif prob < 0.70:
            category = "Moderate Risk / Indeterminate"
            color = "#F59E0B" # Amber
            stenosis_grade = "30% - 69% (Moderate Stenosis)"
        else:
            category = "High Risk / Severe Stenosis"
            color = "#EF4444" # Red
            stenosis_grade = ">=70% (Critical Stenosis)"
            
        # Local SHAP attributions
        exp = explainers.get(v)
        shap_details = []
        if exp:
            shap_details = compute_single_shap(exp, model, sample_df, feature_names)
            
        results[v.upper()] = {
            "probability": round(prob, 4),
            "percentage": round(prob * 100, 1),
            "prediction": prediction,
            "status": "Stenotic" if prediction == 1 else "Normal",
            "category": category,
            "color": color,
            "stenosis_grade": stenosis_grade,
            "top_drivers": shap_details[:10]
        }
        
    # High-level summary
    overall_cad = results.get("CAD", {})
    lad = results.get("LAD", {})
    lcx = results.get("LCX", {})
    rca = results.get("RCA", {})
    
    # Multi-disease and Comorbid Cardiovascular Risk Assessment
    extra_diseases = compute_extra_cardiovascular_diseases(sample_df, results)

    stenotic_count = (
        (1 if lad.get("prediction", 0) == 1 else 0) +
        (1 if lcx.get("prediction", 0) == 1 else 0) +
        (1 if rca.get("prediction", 0) == 1 else 0)
    )
    
    vessel_syndrome = "Single-Vessel Disease" if stenotic_count == 1 else (
        "Multi-Vessel Disease" if stenotic_count > 1 else "Non-Obstructive / Normal"
    )
    
    return {
        "summary": {
            "overall_cad_risk": overall_cad.get("percentage", 0),
            "cad_status": overall_cad.get("status", "Unknown"),
            "risk_tier": overall_cad.get("category", "Unknown"),
            "stenotic_vessel_count": stenotic_count,
            "vessel_syndrome": vessel_syndrome,
            "safety_disclaimer": "FOR INVESTIGATIONAL & CLINICAL DECISION SUPPORT ONLY. NOT A REPLACEMENT FOR FORMAL DIAGNOSTIC CORONARY ANGIOGRAPHY."
        },
        "targets": results,
        "extra_diseases": extra_diseases
    }

def compute_extra_cardiovascular_diseases(df: pd.DataFrame, vessel_results: Dict[str, Any]) -> Dict[str, Any]:
    row = df.iloc[0]
    
    # 1. Acute Myocardial Infarction (STEMI / Ischemia) Threat Score
    # Driven by ST Elevation, Typical CP, LAD Stenosis, Q Wave, Regional RWMA
    st_elev = float(row.get('St Elevation', 0))
    st_depr = float(row.get('St Depression', 0))
    q_wave = float(row.get('Q Wave', 0))
    tcp = float(row.get('Typical Chest Pain', 0))
    rwma = float(row.get('Region RWMA', 0))
    lad_prob = vessel_results.get('LAD', {}).get('probability', 0.2)
    rca_prob = vessel_results.get('RCA', {}).get('probability', 0.2)
    
    stemi_score = min(1.0, (
        st_elev * 0.35 +
        q_wave * 0.25 +
        tcp * 0.15 +
        (rwma / 4.0) * 0.15 +
        lad_prob * 0.25 +
        rca_prob * 0.10
    ))
    
    # 2. Congestive Heart Failure (CHF) & LV Systolic Dysfunction
    # Driven by EF-TTE (<45%), Dyspnea, Edema, RWMA, Age
    ef = float(row.get('EF-TTE', 50))
    dyspnea = float(row.get('Dyspnea', 0))
    edema = float(row.get('Edema', 0))
    chf_hist = float(row.get('CHF', 0))
    
    ef_penalty = max(0.0, (55 - ef) / 40.0) if ef < 55 else 0.05
    chf_score = min(1.0, (
        ef_penalty * 0.50 +
        chf_hist * 0.30 +
        dyspnea * 0.15 +
        edema * 0.15 +
        (rwma / 4.0) * 0.15
    ))
    
    # 3. Arrhythmia & Conduction Defect (Bundle Branch Block / Dyssynchrony)
    # Driven by BBB (LBBB/RBBB), Pulse Rate extremes, T Inversion
    bbb = float(row.get('BBB', 0))
    pr = float(row.get('PR', 75))
    tinversion = float(row.get('Tinversion', 0))
    pr_abnormal = 1.0 if (pr < 55 or pr > 105) else (0.5 if (pr < 60 or pr > 95) else 0.0)
    arrhythmia_score = min(1.0, (
        (0.65 if bbb > 0 else 0.05) +
        tinversion * 0.20 +
        pr_abnormal * 0.25
    ))
    
    # 4. Valvular Heart Disease (Aortic / Mitral Stenosis & Regurgitation)
    # Driven by VHD (1=mild, 2=mod, 3=severe), Systolic Murmur, Diastolic Murmur
    vhd_val = float(row.get('VHD', 0))
    sys_murmur = float(row.get('Systolic Murmur', 0))
    dia_murmur = float(row.get('Diastolic Murmur', 0))
    valvular_score = min(1.0, (
        (vhd_val / 3.0) * 0.65 +
        sys_murmur * 0.25 +
        dia_murmur * 0.30
    ))
    
    # 5. Hypertensive Heart Disease & Concentric LVH
    # Driven by LVH, Blood Pressure, BMI
    lvh = float(row.get('LVH', 0))
    bp = float(row.get('BP', 120))
    htn = float(row.get('HTN', 0))
    bp_excess = max(0.0, (bp - 120) / 70.0)
    lvh_score = min(1.0, (
        lvh * 0.45 +
        bp_excess * 0.35 +
        htn * 0.20
    ))
    
    def grade(score):
        pct = round(score * 100, 1)
        if pct < 30:
            return {"percentage": pct, "category": "Low / Unremarkable", "color": "#10B981"}
        elif pct < 65:
            return {"percentage": pct, "category": "Moderate Risk", "color": "#F59E0B"}
        else:
            return {"percentage": pct, "category": "High / Critical", "color": "#EF4444"}
            
    return {
        "stemi": {
            "name": "Acute Myocardial Infarction / STEMI Threat",
            "desc": "Transmural ischemic necrosis threat from acute coronary thrombosis or critical plaque rupture.",
            **grade(stemi_score)
        },
        "heart_failure": {
            "name": "Congestive Heart Failure & LV Dysfunction",
            "desc": "Impaired ventricular pump capacity and systolic ejection fraction reduction.",
            **grade(chf_score)
        },
        "arrhythmia": {
            "name": "Cardiac Arrhythmia & Conduction Block",
            "desc": "Intraventricular conduction defect (LBBB/RBBB) and electrical dyssynchrony.",
            **grade(arrhythmia_score)
        },
        "valvular": {
            "name": "Valvular Heart Disease (Aortic/Mitral)",
            "desc": "Valvular hemodynamic dysfunction, stenotic turbulence, or regurgitant backflow.",
            **grade(valvular_score)
        },
        "lvh": {
            "name": "Hypertensive Cardiomyopathy & LVH",
            "desc": "Pathological left ventricular wall thickening from chronic arterial afterload.",
            **grade(lvh_score)
        }
    }

class ExerciseSimulationInput(BaseModel):
    features: Dict[str, Any]
    exercise_type: str # 'jogging', 'cycling', 'hiit', 'yoga'
    weeks_active: int = 12

@app.post("/api/simulate-exercise")
def simulate_exercise_intervention(payload: ExerciseSimulationInput):
    """
    Simulates cardiovascular physiological adaptations following evidence-based exercise interventions:
    - Endothelial nitric oxide release & coronary vasodilation
    - Reductions in SBP, DBP, Resting PR
    - Improvements in Ejection Fraction (EF-TTE), HDL elevation, LDL/TG reduction
    - Reduced wall stress and stimulated collateral micro-vessel angiogenesis
    """
    base_features = dict(payload.features)
    ex = payload.exercise_type.lower()
    weeks = payload.weeks_active
    factor = min(1.2, weeks / 12.0)
    
    # Calculate physiological modifications
    modified = dict(base_features)
    
    if ex == 'jogging': # Aerobic Endurance / Brisk Jogging
        bp_drop = 12 * factor
        pr_drop = 8 * factor
        ldl_drop = 22 * factor
        hdl_boost = 7 * factor
        ef_gain = 5 * factor
        angiogenesis_index = 0.85
        exercise_name = "Aerobic Jogging & Brisk Running"
        mechanisms = "Increases myocardial capillary density, enhances coronary flow reserve, and lowers resting sympathetic tone."
    elif ex == 'cycling': # High Cadence Cycling
        bp_drop = 14 * factor
        pr_drop = 7 * factor
        ldl_drop = 18 * factor
        hdl_boost = 6 * factor
        ef_gain = 6 * factor
        angiogenesis_index = 0.80
        exercise_name = "Endurance Cycling & Cardio Cadence"
        mechanisms = "Normalizes systemic vascular resistance, enhances femoral-coronary vascular elasticity, and reduces arterial stiffness."
    elif ex == 'hiit': # High Intensity Interval Training
        bp_drop = 10 * factor
        pr_drop = 6 * factor
        ldl_drop = 28 * factor
        hdl_boost = 9 * factor
        ef_gain = 7 * factor
        angiogenesis_index = 0.95
        exercise_name = "HIIT Metabolic Interval Cardio"
        mechanisms = "Maximizes VO2 peak, triggers robust shear-stress mediated nitric oxide vasodilation, and accelerates lipid clearance."
    else: # Yoga & Vagal Breathwork
        bp_drop = 16 * factor
        pr_drop = 12 * factor
        ldl_drop = 12 * factor
        hdl_boost = 4 * factor
        ef_gain = 3 * factor
        angiogenesis_index = 0.60
        exercise_name = "Vagal Tone Breathwork & Restorative Yoga"
        mechanisms = "Suppresses neurohormonal sympathetic overdrive, boosts parasympathetic vagal reserve, and reduces coronary vasospasm."
        
    # Apply bounds & symptomatic clinical adaptations (Cardiac Rehab Protocol)
    modified['BP'] = max(100, float(modified.get('BP', 130)) - bp_drop)
    modified['PR'] = max(52, float(modified.get('PR', 78)) - pr_drop)
    modified['LDL'] = max(55, float(modified.get('LDL', 120)) - ldl_drop)
    modified['HDL'] = min(80, float(modified.get('HDL', 42)) + hdl_boost)
    modified['EF-TTE'] = min(68, float(modified.get('EF-TTE', 50)) + ef_gain)
    modified['St Elevation'] = 0 # resolution of acute ischemic elevation
    
    # Significant symptomatic and functional recovery under sustained physical rehab
    if weeks >= 8:
        modified['Typical Chest Pain'] = 0 # Angina stabilization
        modified['Dyspnea'] = 0           # Improved ventilatory efficiency
        modified['Function Class'] = max(0, int(float(modified.get('Function Class', 1))) - 1)
        if 'Region RWMA' in modified:
            modified['Region RWMA'] = max(0, int(float(modified.get('Region RWMA', 0))) - 1)
    
    # Run before and after prediction
    baseline_pred = predict_cardiac_risk(PatientInput(features=base_features))
    rehab_pred = predict_cardiac_risk(PatientInput(features=modified))
    
    base_cad = baseline_pred['summary']['overall_cad_risk']
    new_cad = rehab_pred['summary']['overall_cad_risk']
    risk_reduction_pct = round(max(0, base_cad - new_cad), 1)
    
    return {
        "exercise_program": {
            "name": exercise_name,
            "type": ex,
            "weeks": weeks,
            "mechanisms": mechanisms,
            "angiogenesis_collateral_growth": round(angiogenesis_index * 100, 1)
        },
        "physiological_changes": {
            "bp": {"before": round(float(base_features.get('BP', 130)), 1), "after": round(modified['BP'], 1), "diff": -round(bp_drop, 1), "unit": "mmHg"},
            "pr": {"before": round(float(base_features.get('PR', 78)), 1), "after": round(modified['PR'], 1), "diff": -round(pr_drop, 1), "unit": "bpm"},
            "ldl": {"before": round(float(base_features.get('LDL', 120)), 1), "after": round(modified['LDL'], 1), "diff": -round(ldl_drop, 1), "unit": "mg/dL"},
            "hdl": {"before": round(float(base_features.get('HDL', 42)), 1), "after": round(modified['HDL'], 1), "diff": +round(hdl_boost, 1), "unit": "mg/dL"},
            "ef": {"before": round(float(base_features.get('EF-TTE', 50)), 1), "after": round(modified['EF-TTE'], 1), "diff": +round(ef_gain, 1), "unit": "%"}
        },
        "risk_impact": {
            "baseline_cad_risk": base_cad,
            "post_rehab_cad_risk": new_cad,
            "absolute_risk_reduction": risk_reduction_pct,
            "baseline_vessel_status": {
                "LAD": baseline_pred['targets']['LAD']['percentage'],
                "LCX": baseline_pred['targets']['LCX']['percentage'],
                "RCA": baseline_pred['targets']['RCA']['percentage']
            },
            "post_rehab_vessel_status": {
                "LAD": rehab_pred['targets']['LAD']['percentage'],
                "LCX": rehab_pred['targets']['LCX']['percentage'],
                "RCA": rehab_pred['targets']['RCA']['percentage']
            }
        },
        "rehab_prediction": rehab_pred
    }

# Serve Frontend static assets
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Cardiovascular 3D Risk API is active. Open /docs for Swagger."}

if __name__ == "__main__":
    import uvicorn
    print("Starting Cardiovascular 3D Risk API on http://127.0.0.1:8000...")
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=False)
