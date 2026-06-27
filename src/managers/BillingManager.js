'use strict';

const Collection = require('../util/Collection');
const BaseManager = require('./BaseManager');
const GuildBoost = require('../structures/GuildBoost');

/**
 * Manages billing-related API methods.
 * @extends {BaseManager}
 */
class BillingManager extends BaseManager {
  constructor(client) {
    super(client);
    this.paymentSources = new Collection();
    this.guildBoosts = new Collection();
    this.currentSubscription = new Collection();
  }

  fetchPaymentSources() {
    return this.client.rest.methods.fetchPaymentSources().then(d => {
      this.paymentSources = new Collection(d.map(s => [s.id, s]));
      return this.paymentSources;
    });
  }

  fetchGuildBoosts() {
    return this.client.rest.methods.fetchGuildBoosts().then(d => {
      this.guildBoosts = new Collection(d.map(s => [s.id, new GuildBoost(this.client, s)]));
      return this.guildBoosts;
    });
  }

  fetchCurrentSubscription() {
    return this.client.rest.methods.fetchSubscriptions().then(d => {
      this.currentSubscription = new Collection(d.map(s => [s.id, s]));
      return this.currentSubscription;
    });
  }
}

module.exports = BillingManager;
