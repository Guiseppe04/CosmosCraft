@echo off
REM CosmosCraft Deployment Preparation Script (Windows)
REM Run this before deploying to ensure everything is ready

echo.
echo 🚀 CosmosCraft Deployment Preparation
echo ======================================
echo.

REM Check Node.js
echo ✓ Checking Node.js version...
node --version >nul 2>&1 || (echo ✗ Node.js not installed & exit /b 1)
node --version
echo.

REM Check npm
echo ✓ Checking npm version...
npm --version >nul 2>&1 || (echo ✗ npm not installed & exit /b 1)
npm --version
echo.

REM Install server dependencies
echo 📦 Installing server dependencies...
cd server
call npm install || (echo ✗ Failed to install server dependencies & exit /b 1)
cd ..
echo.

REM Install client dependencies
echo 📦 Installing client dependencies...
cd client
call npm install || (echo ✗ Failed to install client dependencies & exit /b 1)
cd ..
echo.

REM Build client
echo 🔨 Building client...
cd client
call npm run build || (echo ✗ Failed to build client & exit /b 1)
cd ..
echo.

REM Check environment files
echo ✓ Checking environment files...
if not exist "server\.env" (
  echo ⚠️  server\.env not found. Creating from .env.example...
  copy server\.env.example server\.env >nul
)

if not exist "client\.env" (
  echo ⚠️  client\.env not found. Creating from .env.example...
  copy client\.env.example client\.env >nul
)
echo.

echo ✅ Deployment preparation complete!
echo.
echo Next steps:
echo 1. Update server\.env with production values
echo 2. Update client\.env with production API URL
echo 3. Push to GitHub
echo 4. Connect repositories to Render and Netlify
echo 5. Set environment variables in Render and Netlify dashboards
echo.
echo Read DEPLOYMENT.md for detailed instructions
