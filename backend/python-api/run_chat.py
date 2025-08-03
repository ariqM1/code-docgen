#!/usr/bin/env python3
"""
Simple script to run the Streamlit chat application
"""
import subprocess
import sys
import os
import time
import requests

def check_backend():
    """Check if the backend server is running"""
    try:
        response = requests.get("http://localhost:4000/api/health", timeout=5)
        return response.status_code == 200
    except:
        return False

def main():
    print("🤖 Repository Chat Assistant")
    print("=" * 40)
    
    # Check if backend is running
    if not check_backend():
        print("❌ Backend server not detected on port 4000")
        print("\nTo start the backend:")
        print("1. cd server")
        print("2. npm install")
        print("3. npm start")
        print("\nThen run this script again.")
        return
    
    print("✅ Backend server detected")
    print("🚀 Starting Streamlit app...")
    
    # Run Streamlit
    try:
        subprocess.run([
            sys.executable, "-m", "streamlit", "run", "streamlit_app.py",
            "--server.port", "8501",
            "--server.address", "localhost"
        ], check=True)
    except KeyboardInterrupt:
        print("\n👋 Chat application stopped")
    except Exception as e:
        print(f"❌ Error running Streamlit: {e}")

if __name__ == "__main__":
    main()