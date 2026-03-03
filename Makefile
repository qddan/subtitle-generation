.PHONY: start start-backend start-frontend build test kill install

# Start both backend and frontend
start:
	@echo "Starting backend (port 8000) and frontend (port 3000)..."
	@make -j2 start-backend start-frontend

start-backend:
	cd backend && python -m uvicorn main:app --reload --port 8000

start-frontend:
	cd frontend && npm run dev

# Build
build:
	cd frontend && npm run build

build-electron:
	cd electron-app && npm run dist:mac

# Test
test:
	cd backend && python -m pytest tests/test_api.py -v

# Install all dependencies
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install
	cd electron-app && npm install

# Kill running servers
kill:
	@lsof -ti :8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti :3000 | xargs kill -9 2>/dev/null || true
	@echo "Ports 8000 & 3000 cleared"
