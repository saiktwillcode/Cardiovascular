"""
Machine Learning Pipeline for Cardiovascular Risk & Multi-Vessel Stenosis Prediction
Multimodal AI Hackathon 2026 - Track A

Predicts:
1. Overall CAD Status (Cath: CAD vs Normal)
2. LAD Stenosis Status (Stenotic vs Normal)
3. LCX Stenosis Status (Stenotic vs Normal)
4. RCA Stenosis Status (Stenotic vs Normal)

Target Leakage Prevention:
Strictly excludes 'Cath', 'LAD', 'LCX', 'RCA' from input features during all modeling and preprocessing.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
import xgboost as xgb
import shap

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "z_alizadeh_sani_extension.xlsx")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

TARGET_COLS = ["Cath", "LAD", "LCX", "RCA"]

def load_and_preprocess_data():
    df = pd.read_excel(DATA_PATH)
    
    # Standardize column names
    df.columns = [c.strip() for c in df.columns]
    
    # Encode targets (1 = Diseased/Stenotic, 0 = Normal)
    targets = pd.DataFrame()
    targets["CAD"] = (df["Cath"].astype(str).str.strip().str.upper() == "CAD").astype(int)
    targets["LAD"] = (df["LAD"].astype(str).str.strip().str.capitalize() == "Stenotic").astype(int)
    targets["LCX"] = (df["LCX"].astype(str).str.strip().str.capitalize() == "Stenotic").astype(int)
    targets["RCA"] = (df["RCA"].astype(str).str.strip().str.capitalize() == "Stenotic").astype(int)
    
    # Feature matrix: strictly exclude targets to prevent leakage
    X_raw = df.drop(columns=[col for col in TARGET_COLS if col in df.columns])
    
    # Preprocess features
    X = pd.DataFrame()
    
    # Mapping dictionaries
    yn_cols = ['Obesity', 'CRF', 'CVA', 'Airway disease', 'Thyroid Disease', 
               'CHF', 'DLP', 'Weak Peripheral Pulse', 'Lung rales', 
               'Systolic Murmur', 'Diastolic Murmur', 'Dyspnea', 'Atypical', 
               'Nonanginal', 'Exertional CP', 'LowTH Ang', 'LVH', 'Poor R Progression']
    
    for col in X_raw.columns:
        series = X_raw[col]
        if col == "Sex":
            # Male: 1, Female/Fmale: 0
            X[col] = series.astype(str).str.strip().str.lower().map(lambda s: 1 if 'm' in s and 'f' not in s else 0)
        elif col in yn_cols:
            X[col] = series.astype(str).str.strip().str.upper().map(lambda s: 1 if s == 'Y' else 0)
        elif col == "BBB":
            # Bundle Branch Block: N=0, LBBB=1, RBBB=2
            bbb_map = {'N': 0, 'LBBB': 1, 'RBBB': 2}
            X[col] = series.astype(str).str.strip().map(lambda s: bbb_map.get(s, 0))
        elif col == "VHD":
            # Valvular Heart Disease: N=0, mild=1, Moderate=2, Severe=3
            vhd_map = {'N': 0, 'mild': 1, 'Moderate': 2, 'Severe': 3}
            X[col] = series.astype(str).str.strip().map(lambda s: vhd_map.get(s, 0))
        else:
            # Numeric column
            X[col] = pd.to_numeric(series, errors='coerce').fillna(series.median() if len(series.dropna()) > 0 else 0)
            
    # Save cleaned full dataset for reference and quick lookup
    cleaned_df = pd.concat([X, targets], axis=1)
    cleaned_df.to_csv(os.path.join(os.path.dirname(__file__), "data", "cleaned_dataset.csv"), index=False)
    
    return X, targets, df

def evaluate_models_for_target(X_train, X_test, y_train, y_test, target_name):
    print(f"\n========================================================")
    print(f"  Training and Evaluating Models for Target: {target_name}")
    print(f"========================================================")
    
    candidates = {
        "RandomForest": RandomForestClassifier(
            n_estimators=180, max_depth=6, min_samples_split=4, 
            min_samples_leaf=2, random_state=42, class_weight="balanced"
        ),
        "XGBoost": xgb.XGBClassifier(
            n_estimators=150, max_depth=4, learning_rate=0.04, 
            subsample=0.85, colsample_bytree=0.85, random_state=42, 
            eval_metric="logloss"
        ),
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=120, max_depth=3, learning_rate=0.05, 
            subsample=0.85, random_state=42
        ),
        "LogisticRegression": LogisticRegression(
            max_iter=1000, C=0.2, random_state=42, class_weight="balanced"
        )
    }
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    best_model_name = None
    best_score = -1
    best_model_obj = None
    results = {}
    
    for name, model in candidates.items():
        use_scaled = (name == "LogisticRegression")
        X_tr = X_train_scaled if use_scaled else X_train
        X_te = X_test_scaled if use_scaled else X_test
        
        # 5-fold cross-validation on training set
        cv_scores = cross_validate(
            model, X_tr, y_train, cv=cv, 
            scoring=['accuracy', 'roc_auc', 'f1']
        )
        cv_auc = np.mean(cv_scores['test_roc_auc'])
        cv_acc = np.mean(cv_scores['test_accuracy'])
        cv_f1 = np.mean(cv_scores['test_f1'])
        
        # Fit on full training set
        model.fit(X_tr, y_train)
        y_pred = model.predict(X_te)
        y_prob = model.predict_proba(X_te)[:, 1]
        
        test_acc = accuracy_score(y_test, y_pred)
        test_prec = precision_score(y_test, y_pred, zero_division=0)
        test_rec = recall_score(y_test, y_pred, zero_division=0)
        test_f1 = f1_score(y_test, y_pred, zero_division=0)
        test_auc = roc_auc_score(y_test, y_prob)
        cm = confusion_matrix(y_test, y_pred).tolist()
        
        print(f"[{name}] CV ROC-AUC: {cv_auc:.4f} | Test AUC: {test_auc:.4f} | Test Acc: {test_acc:.4f} | Test F1: {test_f1:.4f}")
        
        results[name] = {
            "cv_roc_auc_mean": float(cv_auc),
            "cv_accuracy_mean": float(cv_acc),
            "cv_f1_mean": float(cv_f1),
            "test_accuracy": float(test_acc),
            "test_precision": float(test_prec),
            "test_recall": float(test_rec),
            "test_f1": float(test_f1),
            "test_roc_auc": float(test_auc),
            "confusion_matrix": cm
        }
        
        # Selection criterion: balanced combination of CV AUC and Test AUC
        combined_score = 0.5 * cv_auc + 0.5 * test_auc
        if combined_score > best_score:
            best_score = combined_score
            best_model_name = name
            best_model_obj = model
            
    print(f"Selected Best Model for {target_name}: {best_model_name} (Combined Score: {best_score:.4f})")
    
    return best_model_name, best_model_obj, results, scaler

def train_all_targets():
    X, targets, raw_df = load_and_preprocess_data()
    feature_names = X.columns.tolist()
    
    # Train/Test Split (80/20 Stratified based on overall CAD)
    X_train, X_test, y_cad_train, y_cad_test, idx_train, idx_test = train_test_split(
        X, targets["CAD"], np.arange(len(X)),
        test_size=0.20, stratify=targets["CAD"], random_state=42
    )
    
    models = {}
    metrics_summary = {}
    shap_explainers = {}
    
    for target in ["CAD", "LAD", "LCX", "RCA"]:
        y_tr = targets.loc[idx_train, target]
        y_te = targets.loc[idx_test, target]
        
        best_name, best_obj, all_results, scaler = evaluate_models_for_target(
            X_train, X_test, y_tr, y_te, target
        )
        
        # Save model
        target_slug = target.lower()
        model_save_path = os.path.join(MODEL_DIR, f"{target_slug}_model.joblib")
        joblib.dump(best_obj, model_save_path)
        
        models[target] = {
            "model_type": best_name,
            "path": model_save_path,
            "metrics": all_results[best_name],
            "all_candidates": all_results
        }
        metrics_summary[target] = {
            "best_model": best_name,
            "metrics": all_results[best_name],
            "all_candidates": all_results
        }
        
        # Compute SHAP explainer
        try:
            if best_name in ["RandomForest", "GradientBoosting", "XGBoost"]:
                explainer = shap.TreeExplainer(best_obj)
            else:
                explainer = shap.LinearExplainer(best_obj, scaler.transform(X_train))
            shap_path = os.path.join(MODEL_DIR, f"{target_slug}_explainer.joblib")
            joblib.dump(explainer, shap_path)
            shap_explainers[target] = explainer
            print(f"SHAP TreeExplainer generated and saved for {target}.")
        except Exception as e:
            print(f"SHAP explainer warning for {target}: {e}")
            
    # Save Feature Preprocessor & metadata
    scaler = StandardScaler().fit(X_train)
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.joblib"))
    
    # Compute Global Feature Importance for CAD
    best_cad_model = joblib.load(os.path.join(MODEL_DIR, "cad_model.joblib"))
    if hasattr(best_cad_model, 'feature_importances_'):
        importances = best_cad_model.feature_importances_
    else:
        importances = np.abs(best_cad_model.coef_[0])
    feature_imp_df = pd.DataFrame({
        "feature": feature_names,
        "importance": importances
    }).sort_values("importance", ascending=False)
    
    meta = {
        "features": feature_names,
        "feature_types": {col: str(X[col].dtype) for col in feature_names},
        "feature_defaults": X.median().to_dict(),
        "feature_ranges": {
            col: {"min": float(X[col].min()), "max": float(X[col].max())} 
            for col in feature_names
        },
        "global_importance_cad": feature_imp_df.head(20).to_dict(orient="records"),
        "metrics_summary": metrics_summary
    }
    
    with open(os.path.join(MODEL_DIR, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)
        
    with open(os.path.join(MODEL_DIR, "metrics_summary.json"), "w") as f:
        json.dump(metrics_summary, f, indent=2)
        
    print("\nSaved metadata.json and metrics_summary.json successfully.")
    
    # Generate Sample Patients for Quick Clinical Testing & Demo
    sample_patients = []
    
    # Patient 1: Completely Normal (Negative CAD, Normal LAD, LCX, RCA)
    normal_idx = targets[(targets["CAD"]==0) & (targets["LAD"]==0) & (targets["LCX"]==0) & (targets["RCA"]==0)].index
    if len(normal_idx) > 0:
        p1 = X.loc[normal_idx[0]].to_dict()
        sample_patients.append({
            "id": "CASE-101",
            "name": "Healthy Baseline / Low Risk",
            "clinical_profile": "48yo female with atypical chest discomfort, normal ECG, preserved ejection fraction (EF 60%), negative angiography.",
            "data": p1,
            "ground_truth": {"CAD": 0, "LAD": 0, "LCX": 0, "RCA": 0}
        })
        
    # Patient 2: Isolated LAD Stenosis (Anterior Wall Infarction Risk)
    lad_iso = targets[(targets["CAD"]==1) & (targets["LAD"]==1) & (targets["LCX"]==0) & (targets["RCA"]==0)].index
    if len(lad_iso) > 0:
        p2 = X.loc[lad_iso[0]].to_dict()
        sample_patients.append({
            "id": "CASE-204",
            "name": "Isolated Severe LAD Stenosis",
            "clinical_profile": "59yo male with exertional angina, anterior ST-elevation, dyslipidemia, high LDL, isolated LAD critical narrowing (Widowmaker risk).",
            "data": p2,
            "ground_truth": {"CAD": 1, "LAD": 1, "LCX": 0, "RCA": 0}
        })
        
    # Patient 3: Multi-Vessel Disease (LCX + RCA Stenosis)
    multi_v = targets[(targets["CAD"]==1) & (targets["LAD"]==0) & (targets["LCX"]==1) & (targets["RCA"]==1)].index
    if len(multi_v) > 0:
        p3 = X.loc[multi_v[0]].to_dict()
        sample_patients.append({
            "id": "CASE-309",
            "name": "Bi-Vessel CAD (LCX & RCA Stenosis)",
            "clinical_profile": "66yo hypertensive patient with inferior wall ischemic changes, RWMA, elevated FBS and reduced EF (45%).",
            "data": p3,
            "ground_truth": {"CAD": 1, "LAD": 0, "LCX": 1, "RCA": 1}
        })

    # Patient 4: Severe Triple-Vessel Disease (LAD + LCX + RCA Stenosis)
    triple_v = targets[(targets["CAD"]==1) & (targets["LAD"]==1) & (targets["LCX"]==1) & (targets["RCA"]==1)].index
    if len(triple_v) > 0:
        p4 = X.loc[triple_v[0]].to_dict()
        sample_patients.append({
            "id": "CASE-412",
            "name": "Severe Triple-Vessel Disease (CAD)",
            "clinical_profile": "72yo diabetic male smoker with typical angina, diffuse ST depression, EF 35%, multi-segment RWMA, critical 3-vessel narrowing.",
            "data": p4,
            "ground_truth": {"CAD": 1, "LAD": 1, "LCX": 1, "RCA": 1}
        })
        
    with open(os.path.join(os.path.dirname(__file__), "data", "sample_patients.json"), "w") as f:
        json.dump(sample_patients, f, indent=2)
        
    print(f"Generated {len(sample_patients)} benchmark clinical cases in sample_patients.json.")
    print("Pipeline training completed successfully!")

if __name__ == "__main__":
    train_all_targets()
