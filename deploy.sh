#!/bin/bash

# Even G2 × OpenClaw Bridge - Deploy Script
# Usage: ./deploy.sh

set -e

echo "🚀 Even OpenClaw Bridge Deploy Script"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "${RED}❌ Node.js not found. Install from https://nodejs.org/${NC}"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "${RED}❌ Git not found. Install from https://git-scm.com/${NC}"
    exit 1
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "${YELLOW}⚠️  ffmpeg not found. Audio transcription will fail.${NC}"
    echo "   Install: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)"
fi

echo "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Check env vars
if [ -z "$OPENAI_API_KEY" ]; then
    echo "${YELLOW}⚠️  OPENAI_API_KEY not set${NC}"
    read -p "Enter your OpenAI API Key (starts with sk-): " OPENAI_API_KEY
    export OPENAI_API_KEY
fi

if [ -z "$OPENCLAW_WS" ]; then
    echo "${YELLOW}⚠️  OPENCLAW_WS not set${NC}"
    echo "Default: ws://127.0.0.1:18789"
    read -p "Enter OpenClaw WebSocket URL [ws://127.0.0.1:18789]: " OPENCLAW_WS
    OPENCLAW_WS=${OPENCLAW_WS:-ws://127.0.0.1:18789}
    export OPENCLAW_WS
fi

echo ""
echo "🔧 Configuration:"
echo "  OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "  OPENCLAW_WS: $OPENCLAW_WS"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building..."
npm run build

# Test
echo "🧪 Running tests..."
node -e "
const config = require('./dist/config.js');
console.log('Config loaded OK');
console.log('  Port:', config.config.port);
console.log('  OpenClaw:', config.config.openClawWs);
console.log('  OpenAI Key:', config.config.openAiKey ? 'Set' : 'NOT SET');
"

echo "${GREEN}✅ Build successful${NC}"
echo ""

# Ask for deploy method
echo "🌐 Choose deploy method:"
echo "  1) Render (easiest - free tier available)"
echo "  2) Railway"
echo "  3) Local only (skip deploy)"
read -p "Select [1-3]: " DEPLOY_METHOD

case $DEPLOY_METHOD in
    1)
        echo ""
        echo "🚀 Preparing Render deploy..."
        echo ""
        echo "Steps to deploy on Render:"
        echo "1. Go to https://dashboard.render.com/"
        echo "2. Click 'New +' → 'Web Service'"
        echo "3. Connect your GitHub repo or use 'Deploy from Dockerfile'"
        echo "4. Set environment variables:"
        echo "   OPENAI_API_KEY=$OPENAI_API_KEY"
        echo "   OPENCLAW_WS=$OPENCLAW_WS"
        echo "5. Click 'Create Web Service'"
        echo ""
        echo "${YELLOW}Or use Render Blueprint (render.yaml already created):${NC}"
        echo "1. Push this repo to GitHub"
        echo "2. Go to https://render.com/blueprints"
        echo "3. Click 'New Blueprint Instance'"
        echo "4. Connect your repo"
        echo ""
        
        read -p "Push to GitHub now? (y/n): " PUSH_GH
        if [ "$PUSH_GH" = "y" ]; then
            read -p "GitHub repo URL (e.g., https://github.com/username/repo): " GH_REPO
            git remote add origin $GH_REPO 2>/dev/null || true
            git add -A
            git commit -m "Ready for deploy" || true
            git push -u origin master || git push -u origin main
            echo "${GREEN}✅ Pushed to GitHub${NC}"
        fi
        ;;
    
    2)
        echo ""
        echo "🚀 Deploying to Railway..."
        if ! command -v railway &> /dev/null; then
            echo "Installing Railway CLI..."
            npm install -g @railway/cli
        fi
        
        railway login
        railway init
        railway up
        railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
        railway variables set OPENCLAW_WS="$OPENCLAW_WS"
        echo "${GREEN}✅ Deployed to Railway${NC}"
        ;;
    
    3)
        echo ""
        echo "🏠 Running locally..."
        echo "Starting server on http://localhost:3000"
        echo "Press Ctrl+C to stop"
        echo ""
        npm start
        ;;
    
    *)
        echo "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo "${GREEN}🎉 Done!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure your Even G2 plugin to connect to your deployed URL"
echo "2. Test with long press on touchbar"
echo "3. Check dashboard at your-app-url.com"
