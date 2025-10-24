#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# --- Backend Installation ---
echo "Installing backend dependencies..."
pip install -r backend/requirements.txt

# --- Frontend Installation ---
echo "Installing frontend dependencies..."
npm install --prefix frontend

echo "Installation complete."
