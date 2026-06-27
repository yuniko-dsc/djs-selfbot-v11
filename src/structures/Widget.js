'use strict';

const Collection = require('../util/Collection');

/**
 * Represents a guild widget.
 */
class Widget {
  constructor(client, data) {
    this.client = client;
    this.id = data.id;
    this.name = data.name;
    this.instantInvite = data.instant_invite;
    this.channels = new Collection((data.channels || []).map(c => [c.id, c]));
    this.members = (data.members || []).map(m => ({
      id: m.id,
      username: m.username,
      discriminator: m.discriminator,
      avatar: m.avatar,
      status: m.status,
      avatarUrl: m.avatar_url,
    }));
    this.presenceCount = data.presence_count;
  }
}

module.exports = Widget;
