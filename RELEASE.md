# Release v1.0.0 - Anki Media Fix

## Summary

Anki Media Fix is a new Obsidian plugin that solves the frustrating problem of missing media files in Anki flashcards. When images or audio files disappear from your Anki cards, this plugin finds them in your Obsidian vault and sends them back to Anki.

## Why This Plugin?

Many users of the Obsidian to Anki workflow have experienced a common issue: media files (images, audio) referenced in their flashcards suddenly go missing in Anki. This can happen due to:

- Sync issues between devices
- AnkiWeb sync problems
- Bugs in media handling
- Accidental deletion of Anki's media folder

Instead of manually re-exporting all notes or hunting down individual files, this plugin automates the entire recovery process.

## Key Features

✅ **Smart Detection** - Identifies exactly which files are missing in Anki  
✅ **Vault-Wide Search** - Finds media files anywhere in your Obsidian vault  
✅ **Safe Operation** - Only sends files to Anki, never deletes or modifies anything  
✅ **Independent** - Works alongside Obsidian to Anki without conflicts  
✅ **Progress Tracking** - Shows real-time progress during sync  

## Installation

1. Install AnkiConnect addon in Anki (code: `2055492159`)
2. Copy `main.js` and `manifest.json` to your vault's `.obsidian/plugins/obsidian-anki-media-fix/` folder
3. Enable the plugin in Obsidian settings

## Usage

1. Open Anki
2. In Obsidian, press `Ctrl/Cmd + P`
3. Search for "Anki Media Fix"
4. Choose "Sync missing media" or "Sync all media"

## Requirements

- Obsidian v0.15.0 or higher
- Anki with AnkiConnect addon installed
- Desktop only (not mobile)

---

**Full Changelog**: Initial release
