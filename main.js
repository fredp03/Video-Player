const { Plugin } = require('obsidian');
const fs = require('fs');
const path = require('path');

class VideoPlayerPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('video-player', (source, el) => {
      const url = this.parseUrl(source);
      if (!url) {
        el.createEl('p', { text: 'No URL provided.' });
        return;
      }
      const videoId = this.extractVideoId(url);
      const html = this.getPlayerHtml(videoId);

      const iframe = el.createEl('iframe');
      iframe.setAttr('allowfullscreen', '');
      iframe.setAttr('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.style.width = '100%';
      iframe.style.border = '0';
      iframe.srcdoc = html;
    });
  }

  parseUrl(source) {
    for (const line of source.split('\n')) {
      const [key, value] = line.split(':');
      if (key && key.trim() === 'url') return value.trim();
    }
    return '';
  }

  extractVideoId(url) {
    const match = url.match(/(?:v=|\/)([\w-]{11})(?:[?&]|$)/);
    return match ? match[1] : url;
  }

  getPlayerHtml(videoId) {
    const filePath = path.join(__dirname, 'player.html');
    let html = fs.readFileSync(filePath, 'utf8');
    return html.replace(/OJxD__RvyZ4/g, videoId);
  }
}

module.exports = VideoPlayerPlugin;
