# Changelog

All notable changes to the Anki Media Fix plugin will be documented in this file.

## [1.0.0] - 2026-02-04

### Initial Release 🎉

First public release of Anki Media Fix plugin for Obsidian.

### Features

- **Sync All Media**: Force resend all media files (images, audio) referenced in Anki notes back to Anki
- **Sync Missing Media Only**: Smart sync that detects and sends only the files that are actually missing in Anki's media folder
- **List Missing Media**: Preview which files are missing before performing any sync operation
- **Automatic File Discovery**: Searches your entire Obsidian vault to find media files by name
- **Configurable Media Folder**: Option to specify a primary media folder for faster searches
- **Batch Processing**: Configurable batch size for stable processing of large collections
- **Progress Notifications**: Real-time feedback during sync operations
- **Detailed Results**: Summary modal showing successful transfers and files not found in vault

### Technical Details

- Uses AnkiConnect API (port 8765) for communication with Anki
- Extracts media references from HTML img tags, sound tags, and markdown image syntax
- Supports all common image formats (png, jpg, jpeg, gif, webp, svg, excalidraw.png)
- Supports audio formats (mp3, wav, ogg, m4a, mp4)
- Does not modify any Obsidian to Anki plugin data or settings

---

## Future Plans

- [ ] Support for selective deck/tag filtering
- [ ] Dry-run mode with detailed report
- [ ] Integration with Obsidian to Anki plugin's "Added Media" list
