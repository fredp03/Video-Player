# Obsidian Video Player Plugin

An interactive video player plugin for Obsidian that allows you to embed YouTube videos with advanced bookmark functionality.

## Features

- **YouTube Video Embedding**: Easily embed YouTube videos in your notes
- **Interactive Controls**: Play, pause, and seek through videos
- **Bookmark System**: Add timestamped bookmarks with notes
- **Responsive Design**: Adapts to your Obsidian theme
- **Keyboard Shortcuts**: Spacebar for play/pause when hovering over video

## Usage

To add a video player to your note, use the following code block syntax:

````markdown
```video-player
url: https://www.youtube.com/watch?v=VIDEO_ID
```
````

### Example

````markdown
```video-player
url: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```
````

## Controls

- **Click video or play button**: Play/pause the video
- **Click progress bar**: Seek to specific time
- **Bookmark button** (top right): Show/hide bookmarks panel
- **Add bookmark button** (bottom right): Add a bookmark at current time
- **Spacebar**: Play/pause when hovering over video

## Bookmarks

- Click the bookmark icon to show/hide the bookmarks panel
- Click the "+" button to add a bookmark at the current time
- Click any bookmark to jump to that timestamp
- Double-click a bookmark to edit its text
- Command/Ctrl + double-click to delete a bookmark

## Commands

- **Insert Video Player**: Adds a video player code block at the cursor. You will be prompted for a YouTube URL.

## Installation

### Manual Installation

1. Download the latest release from the GitHub repository
2. Extract the files to your Obsidian plugins folder:
   - Windows: `%APPDATA%\Obsidian\plugins\obsidian-video-player\`
   - macOS: `~/Library/Application Support/obsidian/plugins/obsidian-video-player/`
   - Linux: `~/.config/obsidian/plugins/obsidian-video-player/`
3. Enable the plugin in Obsidian's Community Plugins settings

### Development Installation

1. Clone this repository to your plugins folder
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. Enable the plugin in Obsidian

## Development

```bash
# Install dependencies
npm install

# Start development build (watches for changes)
npm run dev

# Build for production
npm run build
```

## Support

If you encounter any issues or have feature requests, please open an issue on the GitHub repository.

## License

MIT License - see LICENSE file for details.
