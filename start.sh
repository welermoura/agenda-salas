#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# --- Activate Virtual Environment ---
echo "Activating Python virtual environment..."
source venv/bin/activate

# --- Start Backend Server ---
echo "Starting backend server from venv..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 > backend.log &

# --- Start Frontend Server ---
echo "Starting frontend server..."
npm start --prefix frontend > frontend.log &

echo "Application started."
echo "Frontend is running on http://localhost:3000"
echo "Backend is running on http://localhost:8000"
