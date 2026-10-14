import urllib.request
import os
import pandas as pd

url = "https://archive.ics.uci.edu/static/public/411/extention%20of%20z-alizadeh%20sani%20dataset.xlsx"
out_path = "z_alizadeh_sani_extension.xlsx"

print(f"Downloading dataset from {url}...")
try:
    headers = {'User-Agent': 'Mozilla/5.0'}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response, open(out_path, 'wb') as out_file:
        data = response.read()
        out_file.write(data)
    print(f"Downloaded successfully! File size: {os.path.getsize(out_path)} bytes")

    # Read and inspect
    df = pd.read_excel(out_path)
    print(f"Dataset shape: {df.shape}")
    print("Columns:")
    print(df.columns.tolist())
    print("\nSample targets:")
    for col in ['Cath', 'CAD', 'LAD', 'LCX', 'RCA']:
        if col in df.columns:
            print(f"{col} value counts:\n{df[col].value_counts()}\n")
except Exception as e:
    print(f"Error: {e}")
