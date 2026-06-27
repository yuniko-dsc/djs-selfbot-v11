'use strict';

const Collection = require('../util/Collection');
const BaseManager = require('./BaseManager');
const Session = require('../structures/Session');

/**
 * Manages active auth sessions.
 * @extends {BaseManager}
 */
class SessionManager extends BaseManager {
  constructor(client) {
    super(client);
    this.cache = new Collection();
    this.currentSessionIdHash = null;
  }

  fetch() {
    return this.client.rest.methods.fetchSessions().then(data => {
      const allData = data.user_sessions || data;
      this.cache.clear();
      for (const session of allData) {
        const s = new Session(session);
        this.cache.set(session.id_hash || session.id, s);
      }
      return this.cache;
    });
  }

  logoutAllDevices() {
    return this.client.rest.methods.logoutAllSessions(
      this.cache.map(session => session.idHash || session.id),
    );
  }

  get currentSession() {
    if (!this.currentSessionIdHash) return null;
    return this.cache.get(this.currentSessionIdHash) || null;
  }
}

module.exports = SessionManager;
