'use strict';

/**
 * Represents a guild boost subscription slot.
 */
class GuildBoost {
  constructor(client, data) {
    this.client = client;
    this.id = data.id;
    this.subscriptionId = data.subscription_id;
    this.premiumGuildSubscription = data.premium_guild_subscription;
    this.canceled = Boolean(data.canceled);
    this.cooldownEndsAt = data.cooldown_ends_at ? new Date(data.cooldown_ends_at) : null;
  }
}

module.exports = GuildBoost;
