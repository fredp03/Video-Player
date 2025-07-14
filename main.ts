import { Plugin, MarkdownPostProcessorContext, MarkdownRenderChild, Component } from 'obsidian';

interface VideoPlayerSettings {
	defaultWidth: number;
	defaultHeight: number;
}

const DEFAULT_SETTINGS: VideoPlayerSettings = {
	defaultWidth: 550,
	defaultHeight: 282
};

class VideoPlayerInstance {
	private player: any;
	private container: HTMLElement;
	private component: Component;
	
	public isPlaying = false;
	public currentTime = 0;
	public totalTime = 0;
	public bookmarksVisible = false;
	public addingBookmark = false;
	public isDragging = false;
	public bookmarkTime = 0;
	public updateInterval: ReturnType<typeof setInterval> | null = null;
	public isCommandPressed = false;
	public isHoveringVideo = false;

	// DOM elements
	public videoContainer!: HTMLElement;
	public playPauseButton!: HTMLElement;
	public progressContainer!: HTMLElement;
	public progressIndicator!: HTMLElement;
	public bookmarkButton!: HTMLElement;
	public bookmarksWrapper!: HTMLElement;
	public addBookmarkBtn!: HTMLElement;
	public newBookmarkInput!: HTMLElement;
	public bookmarksList!: HTMLElement;
	public videoInfo!: HTMLElement;
	public bottomControls!: HTMLElement;

	constructor(container: HTMLElement, player: any, component: Component) {
		this.container = container;
		this.player = player;
		this.component = component;
		this.initializeElements();
		this.bindEvents();
	}

	private initializeElements() {
		this.videoContainer = this.container.querySelector('.video-container') as HTMLElement;
		this.playPauseButton = this.container.querySelector('.start-stop-control') as HTMLElement;
		this.progressContainer = this.container.querySelector('.progress-container') as HTMLElement;
		this.progressIndicator = this.container.querySelector('.video-position') as HTMLElement;
		this.bookmarkButton = this.container.querySelector('.bookmark-button') as HTMLElement;
		this.bookmarksWrapper = this.container.querySelector('.bookmarks-wrapper') as HTMLElement;
		this.addBookmarkBtn = this.container.querySelector('.add-bookmark-btn') as HTMLElement;
		this.newBookmarkInput = this.container.querySelector('.new-bookmark-input') as HTMLElement;
		this.bookmarksList = this.container.querySelector('.bookmarks-list') as HTMLElement;
		this.videoInfo = this.container.querySelector('.video-info') as HTMLElement;
		this.bottomControls = this.container.querySelector('.bottom-controls') as HTMLElement;
	}

	private bindEvents() {
		// Play/pause controls
		this.component.registerDomEvent(this.videoContainer, 'click', () => this.togglePlay());
		this.component.registerDomEvent(this.playPauseButton, 'click', () => this.togglePlay());

		// Keyboard controls - spacebar for play/pause when hovering over video
		this.component.registerDomEvent(this.videoContainer, 'mouseenter', () => {
			this.isHoveringVideo = true;
		});
		this.component.registerDomEvent(this.videoContainer, 'mouseleave', () => {
			this.isHoveringVideo = false;
		});
		
		this.component.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
			if (e.code === 'Space' && this.isHoveringVideo) {
				e.preventDefault();
				this.togglePlay();
			}
			if (e.metaKey || e.ctrlKey) {
				this.isCommandPressed = true;
			}
		});

		this.component.registerDomEvent(document, 'keyup', (e: KeyboardEvent) => {
			if (!e.metaKey && !e.ctrlKey) {
				this.isCommandPressed = false;
				// Remove hover effect from all bookmarks when command is released
				const bookmarks = this.bookmarksList.querySelectorAll('.bookmark');
				bookmarks.forEach(bookmark => {
					(bookmark as HTMLElement).style.backgroundColor = '';
				});
			}
		});

		// Progress bar
		this.component.registerDomEvent(this.progressContainer, 'click', (e: MouseEvent) => this.seek(e));

		// Progress indicator dragging
		this.component.registerDomEvent(this.progressIndicator, 'mousedown', (e: MouseEvent) => this.startDrag(e));
		this.component.registerDomEvent(document, 'mousemove', (e: MouseEvent) => this.drag(e));
		this.component.registerDomEvent(document, 'mouseup', () => this.endDrag());

		// Bookmark controls
		this.component.registerDomEvent(this.bookmarkButton, 'click', () => this.toggleBookmarks());
		this.component.registerDomEvent(this.addBookmarkBtn, 'click', () => this.showAddBookmark());
		
		// New bookmark controls
		const saveBtn = this.newBookmarkInput.querySelector('.save-bookmark') as HTMLElement;
		const cancelBtn = this.newBookmarkInput.querySelector('.cancel-bookmark') as HTMLElement;
		const input = this.newBookmarkInput.querySelector('input') as HTMLInputElement;

		this.component.registerDomEvent(saveBtn, 'click', () => this.saveBookmark());
		this.component.registerDomEvent(cancelBtn, 'click', () => this.cancelBookmark());
		this.component.registerDomEvent(input, 'keypress', (e: KeyboardEvent) => {
			if (e.key === 'Enter') this.saveBookmark();
		});

		// Bookmark clicks and editing
		this.component.registerDomEvent(this.bookmarksList, 'click', (e: MouseEvent) => {
			const bookmark = (e.target as HTMLElement).closest('.bookmark') as HTMLElement;
			if (bookmark && !bookmark.querySelector('input')) {
				const time = parseInt(bookmark.dataset.time || '0');
				this.seekTo(time);
			}
		});

		this.component.registerDomEvent(this.bookmarksList, 'dblclick', (e: MouseEvent) => {
			const bookmark = (e.target as HTMLElement).closest('.bookmark') as HTMLElement;
			if (bookmark) {
				if (this.isCommandPressed) {
					this.deleteBookmark(bookmark);
				} else {
					this.editBookmark(bookmark);
				}
			}
		});

		// Bookmark hover effects for command delete
		this.component.registerDomEvent(this.bookmarksList, 'mouseover', (e: MouseEvent) => {
			const bookmark = (e.target as HTMLElement).closest('.bookmark') as HTMLElement;
			if (bookmark && this.isCommandPressed) {
				bookmark.style.backgroundColor = '#EFBBBC';
			}
		});

		this.component.registerDomEvent(this.bookmarksList, 'mouseout', (e: MouseEvent) => {
			const bookmark = (e.target as HTMLElement).closest('.bookmark') as HTMLElement;
			if (bookmark && this.isCommandPressed) {
				bookmark.style.backgroundColor = '';
			}
		});
	}

	public onPlayerReady() {
		this.totalTime = this.player.getDuration();
		
		// Force highest quality after player is ready
		const availableQualities = this.player.getAvailableQualityLevels();
		if (availableQualities && availableQualities.length > 0) {
			this.player.setPlaybackQuality(availableQualities[0]);
		}
		
		this.updateVideoInfo();
		this.updateDisplay();
		this.updatePlayState();
		
		// Start update interval to sync with YouTube player
		this.updateInterval = setInterval(() => {
			if (this.player && this.player.getCurrentTime) {
				this.currentTime = this.player.getCurrentTime();
				this.updateDisplay();
			}
		}, 100);

		this.component.register(() => {
			if (this.updateInterval) {
				clearInterval(this.updateInterval);
			}
		});
	}

	public onPlayerStateChange(event: any) {
		if (event.data === window.YT.PlayerState.PLAYING) {
			this.isPlaying = true;
		} else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
			this.isPlaying = false;
		}
		this.updatePlayState();
	}

	private togglePlay() {
		if (!this.player) return;
		
		if (this.isPlaying) {
			this.player.pauseVideo();
		} else {
			this.player.playVideo();
		}
	}

	private updatePlayState() {
		const playIcon = this.playPauseButton.querySelector('.play-icon') as HTMLElement;
		const pauseIcon = this.playPauseButton.querySelector('.pause-icon') as HTMLElement;
		
		if (this.isPlaying) {
			this.videoInfo.style.opacity = '0.63';
			this.bottomControls.style.opacity = '1';
			playIcon.style.display = 'none';
			pauseIcon.style.display = 'block';
		} else {
			// Always return video info to full opacity when paused
			this.videoInfo.style.opacity = '1';
			playIcon.style.display = 'block';
			pauseIcon.style.display = 'none';
			
			// Dim controls only if at the beginning
			if (this.currentTime === 0) {
				this.bottomControls.style.opacity = '0.28';
			} else {
				this.bottomControls.style.opacity = '1';
			}
		}
	}

	private seek(e: MouseEvent) {
		if (this.isDragging || !this.player) return;
		
		const rect = this.progressContainer.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const percentage = clickX / rect.width;
		this.seekTo(percentage * this.totalTime);
	}

	private startDrag(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		this.isDragging = true;
		this.progressIndicator.style.cursor = 'grabbing';
		document.body.style.userSelect = 'none';
	}

	private drag(e: MouseEvent) {
		if (!this.isDragging || !this.player) return;
		
		const rect = this.progressContainer.getBoundingClientRect();
		const dragX = e.clientX - rect.left;
		const percentage = Math.max(0, Math.min(1, dragX / rect.width));
		this.seekTo(percentage * this.totalTime);
	}

	private endDrag() {
		if (!this.isDragging) return;
		
		this.isDragging = false;
		this.progressIndicator.style.cursor = 'grab';
		document.body.style.userSelect = '';
	}

	private seekTo(time: number) {
		if (!this.player) return;
		
		this.currentTime = Math.max(0, Math.min(time, this.totalTime));
		this.player.seekTo(time, true);
		this.updateDisplay();
	}

	private updateDisplay() {
		// Update progress indicator position
		if (this.totalTime > 0) {
			const percentage = this.currentTime / this.totalTime;
			const progressBarWidth = 472;
			const indicatorPosition = percentage * progressBarWidth;
			this.progressIndicator.style.left = `${indicatorPosition - 10}px`;
		}
	}

	private formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	private toggleBookmarks() {
		this.bookmarksVisible = !this.bookmarksVisible;
		
		if (this.bookmarksVisible) {
			this.bookmarksWrapper.classList.remove('video-player-bookmarks-hiding');
			this.bookmarksWrapper.classList.add('video-player-bookmarks-showing');
			this.addBookmarkBtn.style.opacity = '1';
		} else {
			this.bookmarksWrapper.classList.remove('video-player-bookmarks-showing');
			this.bookmarksWrapper.classList.add('video-player-bookmarks-hiding');
			this.addBookmarkBtn.style.opacity = '0';
		}
	}

	private showAddBookmark() {
		this.addingBookmark = true;
		this.bookmarkTime = this.currentTime;
		this.newBookmarkInput.style.display = 'block';
		const input = this.newBookmarkInput.querySelector('input') as HTMLInputElement;
		input.focus();
		const timeSpan = this.newBookmarkInput.querySelector('.new-bookmark-time') as HTMLElement;
		timeSpan.textContent = this.formatTime(this.bookmarkTime);
	}

	private saveBookmark() {
		const input = this.newBookmarkInput.querySelector('input') as HTMLInputElement;
		const text = input.value.trim();
		
		if (text) {
			this.addBookmark(text, this.bookmarkTime);
			input.value = '';
		}
		
		this.cancelBookmark();
	}

	private cancelBookmark() {
		this.addingBookmark = false;
		this.newBookmarkInput.style.display = 'none';
		const input = this.newBookmarkInput.querySelector('input') as HTMLInputElement;
		input.value = '';
	}

	private addBookmark(text: string, time: number) {
		const bookmark = document.createElement('div');
		bookmark.className = 'bookmark';
		bookmark.setAttribute('data-time', Math.floor(time).toString());
		bookmark.style.cssText = 'padding-left: 13px; padding-right: 13px; padding-top: 5px; padding-bottom: 5px; background: var(--background-primary); box-shadow: 0px 0px 2.799999952316284px rgba(0, 0, 0, 0.25); border-radius: 3px; justify-content: space-between; align-items: center; gap: 8px; display: flex; cursor: pointer; margin: 5px;';
		
		bookmark.innerHTML = `
			<div class="bookmark-text" style="flex: 1; color: var(--text-normal); font-size: 11px; font-family: var(--font-interface); font-weight: 400;">${text}</div>
			<div class="timestamp" style="color: var(--text-muted); font-size: 11px; font-family: var(--font-interface); font-weight: 400;">${this.formatTime(time)}</div>
		`;
		
		// Insert in chronological order
		const bookmarks = Array.from(this.bookmarksList.children);
		let inserted = false;
		
		for (let i = 0; i < bookmarks.length; i++) {
			const bookmarkTime = parseInt((bookmarks[i] as HTMLElement).dataset.time || '0');
			if (time < bookmarkTime) {
				this.bookmarksList.insertBefore(bookmark, bookmarks[i]);
				inserted = true;
				break;
			}
		}
		
		if (!inserted) {
			this.bookmarksList.appendChild(bookmark);
		}
	}

	private editBookmark(bookmark: HTMLElement) {
		const textElement = bookmark.querySelector('.bookmark-text') as HTMLElement;
		const currentText = textElement.textContent || '';
		
		textElement.style.opacity = '0';
		
		setTimeout(() => {
			const input = document.createElement('input');
			input.type = 'text';
			input.value = currentText;
			input.className = 'bookmark-input';
			input.style.cssText = 'flex: 1; border: none; outline: none; background: transparent; color: var(--text-normal); font-size: 11px; font-family: var(--font-interface); font-weight: 400; opacity: 0; transform: scale(0.95);';
			
			textElement.style.display = 'none';
			bookmark.insertBefore(input, textElement);
			
			requestAnimationFrame(() => {
				input.style.opacity = '1';
				input.style.transform = 'scale(1)';
			});
			
			input.focus();
			input.select();
			
			const saveEdit = () => {
				const newText = input.value.trim();
				if (newText && newText !== currentText) {
					textElement.textContent = newText;
				}
				
				input.style.opacity = '0';
				input.style.transform = 'scale(0.95)';
				
				setTimeout(() => {
					input.remove();
					textElement.style.display = 'block';
					textElement.style.opacity = '1';
				}, 200);
			};
			
			const cancelEdit = () => {
				input.style.opacity = '0';
				input.style.transform = 'scale(0.95)';
				
				setTimeout(() => {
					input.remove();
					textElement.style.display = 'block';
					textElement.style.opacity = '1';
				}, 200);
			};
			
			input.addEventListener('blur', saveEdit);
			input.addEventListener('keypress', (e: KeyboardEvent) => {
				if (e.key === 'Enter') saveEdit();
			});
			input.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Escape') cancelEdit();
			});
		}, 100);
	}

	private deleteBookmark(bookmark: HTMLElement) {
		bookmark.style.transition = 'all 0.3s ease';
		bookmark.style.opacity = '0';
		bookmark.style.transform = 'scale(0.9)';
		
		setTimeout(() => {
			bookmark.remove();
		}, 300);
	}

	private updateVideoInfo() {
		if (this.player && this.player.getVideoData) {
			const videoData = this.player.getVideoData();
			
			// Get video title and creator elements
			const videoTitle = this.container.querySelector('.video-title') as HTMLElement;
			const videoCreator = this.container.querySelector('.video-creator') as HTMLElement;
			
			if (videoData.author && videoCreator) {
				videoCreator.textContent = videoData.author;
			}
		}
	}
}

class VideoPlayerRenderChild extends MarkdownRenderChild {
	private plugin: VideoPlayerPlugin;
	private source: string;

	constructor(containerEl: HTMLElement, source: string, plugin: VideoPlayerPlugin) {
		super(containerEl);
		this.plugin = plugin;
		this.source = source;
	}

	async onload() {
		// Parse the YAML-like content
		const config = this.plugin.parseConfig(this.source);
		
		if (!config.url) {
			const errorDiv = document.createElement('div');
			errorDiv.textContent = 'Error: No URL provided for video player';
			this.containerEl.appendChild(errorDiv);
			return;
		}

		// Extract video ID from YouTube URL
		const videoId = this.plugin.extractYouTubeVideoId(config.url);
		if (!videoId) {
			const errorDiv = document.createElement('div');
			errorDiv.textContent = 'Error: Invalid YouTube URL';
			this.containerEl.appendChild(errorDiv);
			return;
		}

		// Create the video player
		await this.plugin.createVideoPlayer(this.containerEl, videoId, this);
	}
}

export default class VideoPlayerPlugin extends Plugin {
	settings: VideoPlayerSettings;

	async onload() {
		await this.loadSettings();

		// Register the code block processor
		this.registerMarkdownCodeBlockProcessor('video-player', (source, el, ctx) => {
			this.processVideoPlayer(source, el, ctx);
		});
	}

	onunload() {
		// Clean up YouTube API script if it exists
		const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
		if (existingScript) {
			existingScript.remove();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private processVideoPlayer(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		// Create a custom render child for managing the video player
		const renderChild = new VideoPlayerRenderChild(el, source, this);
		ctx.addChild(renderChild);
	}

	parseConfig(source: string): any {
		const config: any = {};
		const lines = source.split('\n');
		
		for (const line of lines) {
			const trimmedLine = line.trim();
			if (trimmedLine && trimmedLine.includes(':')) {
				const [key, ...valueParts] = trimmedLine.split(':');
				const value = valueParts.join(':').trim();
				config[key.trim()] = value;
			}
		}
		
		return config;
	}

	extractYouTubeVideoId(url: string): string | null {
		const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
		const match = url.match(regex);
		return match ? match[1] : null;
	}

	async createVideoPlayer(container: HTMLElement, videoId: string, renderChild: MarkdownRenderChild) {
		// Load YouTube API if not already loaded
		await this.loadYouTubeAPI();

		// Create unique ID for this player
		const playerId = 'youtube-player-' + Math.random().toString(36).substr(2, 9);

		// Create the player HTML structure
		container.innerHTML = `
			<div class="video-player-wrapper" style="width: ${this.settings.defaultWidth}px; margin: 0 auto; position: relative;">
				<div class="video-wrapper" style="padding-left: 24px; padding-right: 24px; flex-direction: column; justify-content: flex-start; align-items: center; gap: 10px; display: flex">
					<div class="top-section" style="align-self: stretch; justify-content: flex-start; align-items: center; gap: 15px; display: inline-flex">
						<div class="video-info" style="padding-top: 6px; padding-bottom: 6px; border-radius: 6px; justify-content: flex-start; align-items: flex-end; gap: 20px; display: flex; transition: opacity 0.3s ease; flex: 1;">
							<div class="video-title" style="display: none; color: var(--text-normal); font-size: 15px; font-family: var(--font-interface); font-weight: 600; word-wrap: break-word; flex: 1; min-width: 0;"></div>
							<div class="video-creator" style="display: none; width: 120px; color: var(--text-muted); font-size: 8px; font-family: var(--font-interface); font-weight: 300; word-wrap: break-word; flex-shrink: 0;"></div>
						</div>
						<div class="bookmark-button" style="cursor: pointer;">
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M1 4.45488C1 2.82623 1 2.01191 1.54917 1.50596C2.09835 1 2.98223 1 4.75 1H7.25C9.01777 1 9.90165 1 10.4508 1.50596C11 2.01191 11 2.82623 11 4.45488V8.3863C11 9.93137 11 10.7039 10.4723 10.9402C9.94463 11.1765 9.28528 10.6992 7.96658 9.74462L7.54455 9.43912C6.80307 8.90238 6.43233 8.634 6 8.634C5.56767 8.634 5.19693 8.90238 4.45545 9.43912L4.03341 9.74462C2.71472 10.6992 2.05537 11.1765 1.52768 10.9402C1 10.7039 1 9.93137 1 8.3863V4.45488Z" stroke="var(--text-muted)"/>
							</svg>
						</div>
					</div>
					
					<div style="position: relative; cursor: pointer;" class="video-container">
						<div class="ytmb-holder" style="width: 502px; height: 282px; box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25); border-radius: 6px; overflow: hidden; aspect-ratio: 16/9; pointer-events: none;">
							<div id="${playerId}" style="width: 200%; height: 100%; margin-left: -50%; pointer-events: none;"></div>
						</div>
					</div>

					<div class="bottom-controls" style="padding-left: 10px; padding-right: 10px; padding-top: 6px; padding-bottom: 6px; flex-direction: column; justify-content: center; align-items: center; gap: 19px; display: flex; transition: opacity 0.3s ease; overflow: visible;">
						<!-- Progress bar container -->
						<div style="position: relative; width: 472px; height: 20px; cursor: pointer;" class="progress-container">
							<!-- Progress bar background -->
							<div class="video-length" style="position: absolute; top: 50%; left: 0; transform: translateY(-50%);">
								<svg width="472" height="20" viewBox="0 0 472 20" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M0 10H472" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round"/>
								</svg>
							</div>
							
							<!-- Progress indicator -->
							<div class="video-position" style="position: absolute; top: 50%; left: 0px; transform: translateY(-50%); transition: left 0.1s ease; cursor: grab;">
								<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
									<g filter="url(#filter0_d_progress)">
										<circle cx="10" cy="10" r="4" fill="var(--interactive-accent)"/>
									</g>
									<defs>
										<filter id="filter0_d_progress" x="3" y="3" width="14" height="17" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
											<feFlood flood-opacity="0" result="BackgroundImageFix"/>
											<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
											<feOffset dy="3"/>
											<feGaussianBlur stdDeviation="1.15"/>
											<feComposite in2="hardAlpha" operator="out"/>
											<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
											<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_progress"/>
											<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_progress" result="shape"/>
										</filter>
									</defs>
								</svg>
							</div>
						</div>

						<!-- Controls row with play button and add bookmark icon -->
						<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; overflow: visible;">
							<div class="start-stop-control" style="cursor: pointer;">
								<svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg">
									<!-- Play button (initially visible) -->
									<g class="play-icon">
										<path d="M10.189 6.5532C10.6037 6.29769 10.6037 5.70231 10.189 5.4468L1.51236 0.100203C1.07165 -0.171362 0.5 0.141017 0.5 0.653406V11.3466C0.5 11.859 1.07165 12.1714 1.51236 11.8998L10.189 6.5532Z" fill="var(--text-normal)"/>
									</g>
									<!-- Pause button (initially hidden) -->
									<g class="pause-icon" style="display: none;">
										<path d="M0.5 1.33333C0.5 0.596954 1.0596 0 1.75 0H3C3.6904 0 4.25 0.596954 4.25 1.33333V10.6667C4.25 11.403 3.6904 12 3 12H1.75C1.0596 12 0.5 11.403 0.5 10.6667V1.33333Z" fill="var(--text-normal)"/>
										<path d="M6.75 1.33333C6.75 0.596954 7.3096 0 8 0H9.25C9.9404 0 10.5 0.596954 10.5 1.33333V10.6667C10.5 11.403 9.9404 12 9.25 12H8C7.3096 12 6.75 11.403 6.75 10.6667V1.33333Z" fill="var(--text-normal)"/>
									</g>
								</svg>
							</div>
							
							<div class="add-bookmark-btn" style="cursor: pointer; padding: 5px; border-radius: 4px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;">
								<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M13.7582 16.897L13.4134 16.5349L13.4134 16.5349L13.7582 16.897ZM15.5 10.125C15.5 9.84886 15.2761 9.625 15 9.625C14.7239 9.625 14.5 9.84886 14.5 10.125H15.5ZM13.897 16.7582L13.5349 16.4134L13.5349 16.4134L13.897 16.7582ZM2.10301 5.24184L2.46514 5.58661L2.46514 5.58661L2.10301 5.24184ZM8.875 4.5C9.15114 4.5 9.375 4.27614 9.375 4C9.375 3.72386 9.15114 3.5 8.875 3.5V4.5ZM2.24184 5.10301L1.89707 4.74089L1.89707 4.74089L2.24184 5.10301ZM5 8.5C4.72386 8.5 4.5 8.72386 4.5 9C4.5 9.27614 4.72386 9.5 5 9.5V8.5ZM11 9.5C11.2761 9.5 11.5 9.27614 11.5 9C11.5 8.72386 11.2761 8.5 11 8.5V9.5ZM5 12.5C4.72386 12.5 4.5 12.7239 4.5 13C4.5 13.2761 4.72386 13.5 5 13.5V12.5ZM8 13.5C8.27614 13.5 8.5 13.2761 8.5 13C8.5 12.7239 8.27614 12.5 8 12.5V13.5ZM14.5 7C14.5 7.27614 14.7239 7.5 15 7.5C15.2761 7.5 15.5 7.27614 15.5 7H14.5ZM15.5 1C15.5 0.723858 15.2761 0.5 15 0.5C14.7239 0.5 14.5 0.723858 14.5 1H15.5ZM12 3.5C11.7239 3.5 11.5 3.72386 11.5 4C11.5 4.27614 11.7239 4.5 12 4.5V3.5ZM18 4.5C18.2761 4.5 18.5 4.27614 18.5 4C18.5 3.72386 18.2761 3.5 18 3.5V4.5ZM1 11.875H0.5V16H1H1.5V11.875H1ZM3 18V18.5H7.125V18V17.5H3V18ZM7.125 18V18.5C8.93622 18.5 10.3433 18.501 11.4404 18.3579C12.551 18.2131 13.4161 17.9131 14.1029 17.2591L13.7582 16.897L13.4134 16.5349C12.9417 16.9839 12.3151 17.2354 11.3111 17.3663C10.2937 17.499 8.96354 17.5 7.125 17.5V18ZM15 10.125H14.5C14.5 11.9635 14.499 13.2937 14.3663 14.3111C14.2354 15.3151 13.9839 15.9417 13.5349 16.4134L13.897 16.7582L14.2591 17.1029C14.9131 16.4161 15.2131 15.551 15.3579 14.4404C15.501 13.3433 15.5 11.9362 15.5 10.125H15ZM13.7582 16.897L14.1029 17.2591C14.1563 17.2083 14.2083 17.1563 14.2591 17.1029L13.897 16.7582L13.5349 16.4134C13.4954 16.4549 13.4549 16.4954 13.4134 16.5349L13.7582 16.897ZM1 16H0.5C0.5 16.4573 0.498938 16.8505 0.54107 17.1639C0.585136 17.4917 0.684509 17.8058 0.93934 18.0607L1.29289 17.7071L1.64645 17.3536C1.60838 17.3155 1.56131 17.2475 1.53215 17.0306C1.50106 17.7994 1.5 16.4855 1.5 16H1ZM3 18V17.5C2.51446 17.5 2.20061 17.4989 1.96935 17.4678C1.75248 17.4387 1.68451 17.3916 1.64645 17.3536L1.29289 17.7071L0.93934 18.0607C1.19417 18.3155 1.50835 18.4149 1.8361 18.4589C2.14948 18.5011 2.54273 18.5 3 18.5V18ZM1 11.875H1.5C1.5 10.0365 1.501 8.70627 1.63368 7.68887C1.7646 6.68494 2.01607 6.05828 2.46514 5.58661L2.10301 5.24184L1.74089 4.89707C1.08694 5.58393 0.786905 6.44897 0.642075 7.55955C0.499002 8.65665 0.5 10.0638 0.5 11.875H1ZM8.875 4V3.5C7.06378 3.5 5.65665 3.499 4.55955 3.64207C3.44897 3.78691 2.58393 4.08694 1.89707 4.74089L2.24184 5.10301L2.58661 5.46514C3.05828 5.01607 3.68494 4.7646 4.68887 4.63368C5.70627 4.501 7.03646 4.5 8.875 4.5V4ZM2.10301 5.24184L2.46514 5.58661C2.50463 5.54513 2.54513 5.50463 2.58661 5.46514L2.24184 5.10301L1.89707 4.74089C1.84374 4.79166 1.79166 4.84374 1.74089 4.89707L2.10301 5.24184ZM5 9V9.5H11V9V8.5H5V9ZM5 13V13.5H8V13V12.5H5V13ZM15 7H15.5V4H15H14.5V7H15ZM15 4H15.5V1H15H14.5V4H15ZM12 4V4.5H15V4V3.5H12V4ZM15 4V4.5H18V4V3.5H15V4Z" fill="var(--text-normal)"/>
								</svg>
							</div>
						</div>
					</div>
				</div>

				<!-- Bookmarks Section -->
				<div class="bookmarks-wrapper video-player-bookmarks-hiding" style="width: 444px; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 22px; display: flex; margin: 0 auto; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: top; opacity: 0; max-height: 0; margin-top: 0; margin-bottom: 0; transform: scaleY(0); overflow: hidden;">
					<div class="bookmarks-list" style="width: 100%; flex-direction: column; gap: 10px; display: flex; padding: 5px;">
						<!-- Bookmarks will be added here -->
					</div>
				</div>

				<!-- New bookmark input (hidden by default) -->
				<div class="new-bookmark-input" style="width: 444px; margin: 10px auto; padding: 13px; background: var(--background-primary); box-shadow: 0px 0px 2.8px rgba(0, 0, 0, 0.25); border-radius: 4px; display: none;">
					<input type="text" placeholder="Add a note for this moment..." style="width: 100%; border: none; outline: none; font-size: 11px; font-family: var(--font-interface); color: var(--text-normal); margin-bottom: 8px; background: transparent;">
					<div style="display: flex; justify-content: space-between; align-items: center;">
						<span style="color: var(--text-normal); font-size: 11px; font-family: var(--font-interface);" class="new-bookmark-time">0:00</span>
						<div>
							<button class="cancel-bookmark" style="background: transparent; border: 1px solid var(--background-modifier-border); padding: 4px 8px; margin-right: 5px; border-radius: 3px; font-size: 10px; cursor: pointer; color: var(--text-normal);">Cancel</button>
							<button class="save-bookmark" style="background: var(--interactive-accent); color: var(--text-on-accent); border: none; padding: 4px 8px; border-radius: 3px; font-size: 10px; cursor: pointer;">Save</button>
						</div>
					</div>
				</div>
			</div>
		`;

		// Wait for YouTube API to be ready and initialize the player
		await this.initializePlayer(container, playerId, videoId, renderChild);
	}

	private async loadYouTubeAPI(): Promise<void> {
		return new Promise((resolve) => {
			// Check if YouTube API is already loaded
			if (window.YT && window.YT.Player) {
				resolve();
				return;
			}

			// Check if script is already in DOM
			const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
			if (existingScript) {
				// Wait for it to load
				const checkYT = () => {
					if (window.YT && window.YT.Player) {
						resolve();
					} else {
						setTimeout(checkYT, 100);
					}
				};
				checkYT();
				return;
			}

			// Load YouTube API
			const script = document.createElement('script');
			script.src = 'https://www.youtube.com/iframe_api';
			script.async = true;
			
			// Set up global callback
			window.onYouTubeIframeAPIReady = () => {
				resolve();
			};

			document.head.appendChild(script);
		});
	}

	private async initializePlayer(container: HTMLElement, playerId: string, videoId: string, renderChild: MarkdownRenderChild) {
		// Wait a bit for DOM to be ready
		await new Promise(resolve => setTimeout(resolve, 100));

		const playerElement = container.querySelector(`#${playerId}`) as HTMLElement;
		if (!playerElement) {
			console.error('Player element not found');
			return;
		}

		// Create player instance
		const player = new window.YT.Player(playerId, {
			height: '282',
			width: '1004',
			videoId: videoId,
			playerVars: {
				'autoplay': 1,
				'mute': 1,
				'loop': 1,
				'controls': 0,
				'color': 'white',
				'modestbranding': 1,
				'playsinline': 1,
				'enablejsapi': 1,
				'playlist': videoId,
				'rel': 0,
				'hd': 1,
				'vq': 'hd2160',
				'quality': 'highres',
				'suggestedQuality': 'hd2160',
				'iv_load_policy': 3
			},
			events: {
				'onReady': (event: any) => {
					const playerInstance = new VideoPlayerInstance(container, player, renderChild);
					playerInstance.onPlayerReady();
					
					// Unmute the player after initialization (since we start muted to enable autoplay)
					player.unMute();
				},
				'onStateChange': (event: any) => {
					// Find the player instance and handle state change
					const playerInstance = (container as any)._videoPlayerInstance;
					if (playerInstance) {
						playerInstance.onPlayerStateChange(event);
					}
				}
			}
		});

		// Store player instance reference on container
		(container as any)._videoPlayerInstance = new VideoPlayerInstance(container, player, renderChild);
	}
}

declare global {
	interface Window {
		YT: any;
		onYouTubeIframeAPIReady: () => void;
	}
}
