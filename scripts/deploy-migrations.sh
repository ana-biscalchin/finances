#!/bin/bash

# Deploy script for Render
# This script runs after build to set up the database

echo "🚀 Starting deployment setup..."

# Check if we're in production
if [ "$NODE_ENV" = "production" ]; then
  echo "📦 Production environment detected"
  
  # Wait for database to be ready
  echo "⏳ Waiting for database connection..."
  sleep 10
  
  # Run migrations
  echo "🔄 Running database migrations..."
  node dist/db/migrate.js
  
  if [ $? -eq 0 ]; then
    echo "✅ Migrations completed successfully"
  else
    echo "❌ Migration failed, but continuing..."
  fi
else
  echo "🔧 Development environment - skipping migrations"
fi

echo "🎉 Deployment setup complete!" 