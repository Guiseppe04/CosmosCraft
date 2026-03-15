#!/bin/bash

# CosmosCraft Deployment Preparation Script
# Run this before deploying to ensure everything is ready

echo "🚀 CosmosCraft Deployment Preparation"
echo "======================================"
echo ""

# Check Node.js
echo "✓ Checking Node.js version..."
node --version || { echo "✗ Node.js not installed"; exit 1; }
echo ""

# Check npm
echo "✓ Checking npm version..."
npm --version || { echo "✗ npm not installed"; exit 1; }
echo ""

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install || { echo "✗ Failed to install server dependencies"; exit 1; }
cd ..
echo ""

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
npm install || { echo "✗ Failed to install client dependencies"; exit 1; }
cd ..
echo ""

# Build client
echo "🔨 Building client..."
cd client
npm run build || { echo "✗ Failed to build client"; exit 1; }
cd ..
echo ""

# Check environment files
echo "✓ Checking environment files..."
if [ ! -f "server/.env" ]; then
  echo "⚠️  server/.env not found. Creating from .env.example..."
  cp server/.env.example server/.env
fi

if [ ! -f "client/.env" ]; then
  echo "⚠️  client/.env not found. Creating from .env.example..."
  cp client/.env.example client/.env
fi
echo ""

echo "✅ Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Update server/.env with production values"
echo "2. Update client/.env with production API URL"
echo "3. Push to GitHub"
echo "4. Connect repositories to Render and Netlify"
echo "5. Set environment variables in Render and Netlify dashboards"
echo ""
echo "Read DEPLOYMENT.md for detailed instructions"
