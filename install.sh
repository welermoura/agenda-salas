#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Setting up Python virtual environment ---"
python3 -m venv venv

echo "--- Installing backend dependencies into the virtual environment ---"
# Call pip from the venv directly to ensure correct installation
./venv/bin/pip install -r backend/requirements.txt

echo "--- Installing frontend dependencies ---"
npm install --prefix frontend

echo "--- Installation complete ---"
echo "To start the application, run: bash start.sh"

# Make start.sh executable
chmod +x start.sh
