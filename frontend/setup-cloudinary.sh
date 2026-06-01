#!/bin/bash

# Cloudinary Integration Installation Script
# Run this in your project root to set up the complete system

echo "🚀 Cloudinary Integration Setup"
echo "================================"

# Install Backend Dependencies
echo ""
echo "📦 Installing Backend Dependencies..."
cd api
npm install cloudinary multer
npm install
cd ..

echo ""
echo "✅ Backend dependencies installed"
echo ""
echo "📋 Next Steps:"
echo "================================"
echo ""
echo "1. Start Backend Server:"
echo "   cd api"
echo "   npm run dev"
echo ""
echo "2. In another terminal, Start Frontend:"
echo "   npm start"
echo ""
echo "3. Test the integration:"
echo "   - Navigate to CloudinaryWorkingExample screen"
echo "   - Click 'Pick Image' or 'Take Photo'"
echo "   - Upload and see your images!"
echo ""
echo "🎉 Setup Complete!"
