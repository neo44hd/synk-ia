#!/bin/bash
# Crear accesos directos en el escritorio de macOS
DESKTOP="$HOME/Desktop"

cat > "$DESKTOP/SynkIA-Archivos.webloc" << 'WEBLOC'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>https://sinkialabs.com/filemanager</string>
</dict>
</plist>
WEBLOC

cat > "$DESKTOP/SynkIA-Admin.webloc" << 'WEBLOC'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>https://sinkialabs.com/admin</string>
</dict>
</plist>
WEBLOC

cat > "$DESKTOP/SynkIA-Chat.webloc" << 'WEBLOC'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>https://sinkialabs.com/chat</string>
</dict>
</plist>
WEBLOC

echo "✓ Accesos directos creados en $DESKTOP"
ls -la "$DESKTOP"/SynkIA-*.webloc
