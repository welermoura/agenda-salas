#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# --- Create and Activate Virtual Environment ---
echo "Creating Python virtual environment..."
python3 -m venv venv

# --- Backend Installation ---
echo "Installing backend dependencies into venv..."
# Activate venv and install requirements
source venv/bin/activate
pip install -r backend/requirements.txt
deactivate

# --- Frontend Installation ---
echo "Installing frontend dependencies..."
npm install --prefix frontend

# --- Make start.sh executable and run it ---
echo "Installation complete. Starting the application..."
chmod +x start.sh
./start.sh
