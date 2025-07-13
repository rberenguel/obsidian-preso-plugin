#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if a version number is provided as an argument.
if [ -z "$1" ];
then
  echo "Error: No version specified."
  echo "Usage: ./release.sh <version>"
  exit 1
fi

VERSION=$1
ARCHIVE_NAME="preso"
DOWNLOADS_DIR="$HOME/Downloads"
RELEASE_ZIP_PATH="$DOWNLOADS_DIR/$ARCHIVE_NAME.zip"
BUILD_DIR="dist"

echo "📦 Starting release process for version $VERSION..."

# 1. Update version numbers
echo "Updating version numbers to $VERSION..."
npm version $VERSION --no-git-tag-version --allow-same-version

# 2. Build the plugin. This will create the 'dist' directory with all final files.
echo "Building the plugin..."
npm run build

# 3. Create the zip archive for the release from the build directory.
echo "Creating zip archive at $RELEASE_ZIP_PATH from '$BUILD_DIR' directory..."

if [ ! -d "$BUILD_DIR" ]; then
    echo "Error: Build directory '$BUILD_DIR' not found. Build may have failed."
    exit 1
fi

# Create the zip file from the contents of the 'dist' directory.
(cd "$BUILD_DIR" && zip -r "$RELEASE_ZIP_PATH" .)

# 4. Commit the version changes and create a git tag.
echo "Committing version changes and tagging..."
git add manifest.json versions.json package.json package-lock.json
git commit -m "chore(release): v$VERSION"
git tag "v$VERSION"

echo "✅ Successfully created release archive at $RELEASE_ZIP_PATH"
echo "👉 Don't forget to run 'git push && git push --tags' to publish the release."