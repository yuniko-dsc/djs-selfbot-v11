'use strict';

/**
 * Represents a web embed (Discord Components v2).
 */
class WebEmbed {
  constructor(data = {}) {
    this.url = data.url || null;
    this.title = data.title || null;
    this.description = data.description || null;
    this.color = data.color || null;
    this.timestamp = data.timestamp || null;
    this.thumbnail = data.thumbnail || null;
    this.image = data.image || null;
    this.footer = data.footer || null;
    this.author = data.author || null;
    this.fields = data.fields || [];
  }

  toJSON() {
    return {
      url: this.url,
      title: this.title,
      description: this.description,
      color: this.color,
      timestamp: this.timestamp,
      thumbnail: this.thumbnail,
      image: this.image,
      footer: this.footer,
      author: this.author,
      fields: this.fields,
    };
  }
}

module.exports = WebEmbed;
