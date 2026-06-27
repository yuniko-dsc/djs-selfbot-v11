'use strict';

const Collection = require('../util/Collection');
const BaseManager = require('./BaseManager');
const backup = require('./backup');

class BackupCacheManager {
  constructor(manager) {
    this._manager = manager;
    this._storage = new Collection();
  }

  get client() {
    return this._manager.client;
  }

  _resolveGuild(guildId) {
    const guild = this.client.guilds.get(guildId);
    if (!guild) throw new Error(`Guild "${guildId}" could not be resolved.`);
    return guild;
  }

  create(guildId, options = {}) {
    const guild = this._resolveGuild(guildId);
    return backup.create(guild, options).then(backupData => {
      this._storage.set(backupData.id, backupData);
      return backupData;
    });
  }

  delete(backupId) {
    return this._storage.delete(backupId);
  }

  clearAll() {
    this._storage.clear();
  }

  load(guildId, backupId, options = {}) {
    const guild = this._resolveGuild(guildId);
    const backupData = this._storage.get(backupId);
    if (!backupData) throw new Error(`Backup "${backupId}" was not found in cache.`);
    return backup.load(backupData, guild, options);
  }

  get(backupId) {
    const backupData = this._storage.get(backupId);
    if (!backupData) return undefined;
    const size = Number((Buffer.byteLength(JSON.stringify(backupData), 'utf8') / 1024).toFixed(2));
    return { id: backupId, data: backupData, size };
  }

  list() {
    return this._storage.keyArray();
  }
}

/**
 * Manages guild backup operations.
 * @extends {BaseManager}
 */
class BackupManager extends BaseManager {
  constructor(client) {
    super(client);
    this.cache = new BackupCacheManager(this);
  }
}

module.exports = BackupManager;
