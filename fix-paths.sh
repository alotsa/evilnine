#!/bin/bash
# Undoes Chrome Ctrl+S path rewrites after saving from Claude's preview.
#
# Handles both filename variants Chrome produces:
#   - "Golf Games.html" + "Golf Games_files/"   (chat preview titled Golf Games)
#   - "index.html"      + "index_files/"        (file shared as 'index')
#
# Rewrites all known asset paths back to their relative / CDN forms.
set -e

SRC=""
FILES_DIR=""
if [ -f "Golf Games.html" ]; then
  SRC="Golf Games.html"
  FILES_DIR="Golf Games_files"
elif [ -d "index_files" ]; then
  SRC="index.html"
  FILES_DIR="index_files"
else
  echo "No saved page found (looking for 'Golf Games.html' or index_files/)."
  echo "Did you save the page here first via Ctrl+S?"
  exit 1
fi

echo "Processing: $SRC"

sed -i '/saved from url/d' "$SRC"

sed -i \
  -e 's|href="file:///[^"]*/manifest\.json"|href="manifest.json"|g' \
  -e 's|href="file:///[^"]*/assets/icon-192\.png"|href="assets/icon-192.png"|g' \
  -e 's|href="file:///[^"]*/assets/icon-180\.png"|href="assets/icon-180.png"|g' \
  -e 's|href="\./[^"]*_files/css2"|href="https://fonts.googleapis.com/css2?family=Bebas+Neue\&family=Courier+Prime:wght@400;700\&family=Manrope:wght@400;500;700;800\&display=swap"|g' \
  -e 's|href="\./[^"]*_files/app\.css"|href="app.css"|g' \
  -e 's|src="\./[^"]*_files/courses\.js"|src="data/courses.js"|g' \
  -e 's|src="\./[^"]*_files/app\.js"|src="app.js"|g' \
  "$SRC"

if [ "$SRC" = "Golf Games.html" ]; then
  mv "Golf Games.html" index.html
fi

rm -rf "$FILES_DIR"

echo "Done. index.html is ready."
echo "Run: git diff index.html | head -50    # sanity-check"
echo "Then: git add . && git commit -m '...' && git push"
