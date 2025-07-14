# YouTube Video Player with Bookmarks - Copilot Instructions

## Project Architecture

This is a single-file YouTube video player with advanced bookmark functionality, built as a monolithic HTML file with embedded CSS and JavaScript. The player integrates with YouTube's IFrame API to provide custom controls while hiding YouTube's native interface.

## Core Components

### VideoPlayer Class (`working-player.html`)
- **Lifecycle**: `constructor → initializeYouTubePlayer → onPlayerReady → bindEvents`
- **State Management**: Synchronizes with YouTube IFrame API every 100ms via `updateInterval`
- **Video Quality**: Forces highest available quality (4K when possible) using `setPlaybackQuality(availableQualities[0])`

### YouTube Integration Patterns
```javascript
// Critical: YouTube player is scaled 300% width with -100% margin to hide controls
width: '1506', // 300% of 502px
style: "width: 300%; height: 100%; margin-left: -100%; pointer-events: none;"

// Quality forcing after player ready
const availableQualities = this.youtubePlayer.getAvailableQualityLevels();
this.youtubePlayer.setPlaybackQuality(availableQualities[0]);
```

### Element Selection Convention
Uses `data-layer` attributes for component identification (not standard data attributes):
```javascript
this.videoContainer = document.querySelector('[data-layer="video-container"]');
this.bookmarkButton = document.querySelector('[data-layer="Bookmark Button"]');
```

## Bookmark System Architecture

### Interaction Patterns
- **Single click**: Seek to timestamp
- **Double click**: Edit bookmark text
- **Command + double click**: Delete bookmark with fade animation
- **Command + hover**: Visual delete preview (`#EFBBBC` background)

### Bookmark State Management
- **Time Capture**: Timestamps captured on button press, not save (`this.bookmarkTime = this.currentTime`)
- **Chronological Insertion**: Manual DOM sorting by `dataset.time` attribute
- **Inline Editing**: Dynamic input replacement with smooth scale animations

### Animation System
```css
.bookmark-input {
    animation: fadeInScale 0.2s ease forwards;
}
/* Bookmark wrapper uses scaleY transforms for smooth show/hide */
.BookmarksWrapper.showing { transform: scaleY(1); }
```

## Event Handling Patterns

### Keyboard Controls
- **Spacebar**: Play/pause only when hovering over video container (`this.isHoveringVideo`)
- **Command Key Tracking**: Cross-platform support (`e.metaKey || e.ctrlKey`)
- **Escape/Enter**: Standard editing controls for bookmark text

### Progress Bar Interaction
- **Drag Detection**: `this.isDragging` prevents seek conflicts during manual scrubbing
- **Click Seeking**: Percentage-based calculation: `(clickX / rect.width) * this.totalTime`

## UI State Management

### Opacity-Based Visibility
- **Video Info**: Dims to `0.63` during playback, full opacity when paused
- **Controls**: Dims to `0.28` only at video start, `1.0` otherwise
- **Add Bookmark Button**: Synchronized with bookmark panel visibility

### CSS Class State Patterns
```javascript
// Smooth state transitions using CSS classes
this.bookmarksWrapper.classList.remove('hiding');
this.bookmarksWrapper.classList.add('showing');
```

## Development Conventions

### When Adding Features
1. **Element Selection**: Use `data-layer` attributes, not IDs or classes
2. **Animations**: Leverage existing CSS transition classes (`fadeInScale`, state classes)
3. **YouTube API**: Always check `this.youtubePlayer` existence before API calls
4. **Time Handling**: Use integer seconds for timestamps, format display separately

### Quality Settings
- Always include both URL parameters (`vq: 'hd2160'`) and programmatic setting
- Quality parameters: `hd: 1`, `vq: 'hd2160'`, `quality: 'highres'`, `suggestedQuality: 'hd2160'`

### Common Patterns
- **Error Prevention**: Guard clauses (`if (!this.youtubePlayer) return;`)
- **Event Delegation**: Use `e.target.closest('[data-layer="bookmark"]')` for dynamic elements
- **Animation Chaining**: `setTimeout` + `requestAnimationFrame` for smooth transitions

## File Structure
- **Single File**: All code in `working-player.html` - CSS in `<style>`, JS in `<script>`
- **No Build Process**: Direct file serving, no compilation or bundling
- **External Dependencies**: Only YouTube IFrame API and Google Fonts

## Testing Approach
- **Manual Testing**: Load HTML file directly in browser
- **Video Changes**: Modify `videoId` and `playlist` parameters in `initializeYouTubePlayer()`
- **Debug Console**: Use browser dev tools, player state exposed via `videoPlayer` global
