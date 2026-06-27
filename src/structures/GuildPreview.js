'use strict';

const Collection = require('../util/Collection');

/**
 * Represents a guild preview.
 */
class GuildPreview {
  constructor(client, data) {
    this.client = client;
    this.id = data.id;
    this.name = data.name;
    this.icon = data.icon;
    this.splash = data.splash;
    this.discoverySplash = data.discovery_splash;
    this.emojis = new Collection((data.emojis || []).map(e => [e.id, e]));
    this.approximateMemberCount = data.approximate_member_count;
    this.approximatePresenceCount = data.approximate_presence_count;
    this.description = data.description;
    this.features = data.features || [];
  }
}

module.exports = GuildPreview;
