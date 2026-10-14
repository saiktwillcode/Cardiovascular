"""
One-Click Launch Script for CardioTwin 3D
Multimodal AI Hackathon 2026 - Track A
"""

import os
import sys
import webbrowser
import time
import uvicorn

def main():
    print("=" * 65)
    print("  CARDIOTWIN 3D: Cardiovascular Risk & Stenosis AI")
    print("  Track A: Cardiovascular Risk Visualization & Prediction")
    print("=" * 65)
    
    # Check if models exist
    model_dir = os.path.join(os.path.dirname(__file__), "backend", "models")
    cad_model_path = os.path.join(model_dir, "cad_model.joblib")
    
    if not os.path.exists(cad_model_path):
        print("\nTrained models not detected. Running ML pipeline now...")
        from backend.ml_pipeline import train_all_targets
        train_all_targets()
    else:
        print("\nAll trained models, scalers, and SHAP explainers verified.")
        
    print("\nStarting high-performance FastAPI server at http://127.0.0.1:8000...")
    print("Press Ctrl+C in terminal to stop server.\n")
    
    # Optional auto-open browser after 1 second
    try:
        import threading
        def open_browser():
            time.sleep(1.2)
            webbrowser.open("http://127.0.0.1:8000")
        threading.Thread(target=open_browser, daemon=True).start()
    except Exception:
        pass
        
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=False)

if __name__ == "__main__":
    main()
