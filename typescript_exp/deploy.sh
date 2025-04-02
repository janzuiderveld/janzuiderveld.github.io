#!/bin/bash

# Exit on error
set -e

echo "Starting deployment process..."

# Navigate to the typescript_exp directory
cd "$(dirname "$0")"

# Build the project
echo "Building the project..."
npm run build

# Navigate to the parent directory (root of the repo)
cd ..

# Copy the build output to the root directory
echo "Copying build files to root directory..."
cp -r typescript_exp/dist/* .

echo "Adding changes to git..."
git add .

# Prompt user for commit message
read -p "Enter commit message: " commit_message

# Commit changes with the provided message
echo "Committing changes..."
git commit -m "$commit_message"

# Push changes to GitHub
echo "Pushing changes to GitHub..."
git push

echo "Deployment completed successfully!" 