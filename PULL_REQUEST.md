# Pull Request: Anki Media Fix Plugin

## Description

This PR introduces a new Obsidian plugin called **Anki Media Fix** that addresses a common pain point for users who sync notes from Obsidian to Anki: missing media files.

## Problem

Users of the Obsidian to Anki workflow frequently encounter situations where images and audio files disappear from their Anki flashcards. The "Check Media" feature in Anki shows hundreds of missing files, but there's no easy way to resend them without re-exporting all notes.

![Missing Media Example](https://github.com/user-attachments/assets/missing-media-screenshot.png)

## Solution

This plugin provides three commands to fix missing media:

1. **Sync only missing media** - Detects which files are missing and sends only those
2. **Sync all media** - Force resends all media files referenced in Anki notes
3. **List missing media** - Shows a preview of missing files before syncing

## How It Works

1. Queries Anki via AnkiConnect API to get all notes
2. Parses note fields to extract media references (`<img>` tags, `[sound:]` tags)
3. Compares against Anki's existing media files
4. Searches the Obsidian vault for missing files
5. Sends files to Anki using `storeMediaFile` API

## Key Design Decisions

- **Non-invasive**: Does not modify any data from the Obsidian to Anki plugin
- **Independent operation**: Works standalone without dependencies on other plugins
- **Safe**: Only sends files to Anki, never deletes or modifies existing content
- **Efficient**: Batch processing with configurable size for large collections

## Technical Implementation

- Written in TypeScript
- Uses AnkiConnect API (default port 8765)
- Supports HTML img tags, sound tags, and markdown image syntax
- Handles URL-encoded filenames
- Searches entire vault or configured media folder

## Testing

- [x] Tested with 800+ missing media files
- [x] Tested with various file formats (png, jpg, mp3, mp4, excalidraw)
- [x] Tested batch processing with large note collections
- [x] Tested error handling when Anki is not running
- [x] Tested with files in nested folder structures

## Files Changed

```
├── main.ts           # Plugin source code
├── manifest.json     # Plugin metadata
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
├── esbuild.config.mjs # Build configuration
├── .eslintrc.cjs     # Linter configuration
├── README.md         # User documentation
└── CHANGELOG.md      # Version history
```

## Checklist

- [x] Code follows project style guidelines
- [x] ESLint passes with no errors
- [x] TypeScript compiles without errors
- [x] Plugin loads correctly in Obsidian
- [x] All commands work as expected
- [x] Settings are saved and loaded correctly
- [x] Documentation is complete

## Screenshots

### Command Palette

![Commands](https://github.com/user-attachments/assets/commands-screenshot.png)

### Sync Progress

![Progress](https://github.com/user-attachments/assets/progress-screenshot.png)

### Results Modal

![Results](https://github.com/user-attachments/assets/results-screenshot.png)

---

**Related Issues**: Fixes missing media problem reported by multiple users in Obsidian to Anki discussions.
