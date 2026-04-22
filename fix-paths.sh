#!/bin/bash
# Undoes Chrome Ctrl+S path rewrites after saving from Claude's preview.
# Run after saving "Golf Games.html" into this folder.
set -e

if [ ! -f "Golf Games.html" ]; then
  echo "No 'Golf Games.html' found. Did you save the page here first?"
  exit 1
fi

# Strip Chrome's injected "saved from url" comment
sed -i '/saved from url/d' "Golf Games.html"

# Restore all asset paths that Chrome rewrote to file:/// or Golf Games_files/
sed -i \
  -e 's|href="file:///[^"]*/manifest\.json"|href="manifest.json"|g' \
  -e 's|href="file:///[^"]*/assets/icon-192\.png"|href="assets/icon-192.png"|g' \
  -e 's|href="file:///[^"]*/assets/icon-180\.png"|href="assets/icon-180.png"|g' \
  -e 's|href="\./Golf Games_files/css2"|href="https://fonts.googleapis.com/css2?family=Bebas+Neue\&family=Courier+Prime:wght@400;700\&family=Manrope:wght@400;500;700;800\&display=swap"|g' \
  "Golf Games.html"

# Rename and clean up
mv "Golf Games.html" index.html
rm -rf "Golf Games_files"

echo "Done. index.html is ready. Run: git add . && git commit -m '...' && git push"
