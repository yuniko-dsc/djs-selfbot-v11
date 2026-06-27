'use strict';

const Collection = require('../util/Collection');
const BaseManager = require('./BaseManager');

/**
 * Manages API methods for user notes and stores their cache.
 * @extends {BaseManager}
 */
class UserNoteManager extends BaseManager {
  constructor(client, data = {}) {
    super(client);
    this.cache = new Collection(Object.entries(data));
  }

  _reload(data = {}) {
    this.cache = new Collection(Object.entries(data));
    return this;
  }

  updateNote(id, note = null) {
    return this.client.rest.methods.setNote({ id }, note).then(() => {
      if (!note) this.cache.delete(id);
      else this.cache.set(id, note);
      return this;
    });
  }

  fetch(user, { cache = true, force = false } = {}) {
    const id = this.resolveId(user);
    if (!force) {
      const existing = this.cache.get(id);
      if (existing) return Promise.resolve(existing);
    }
    return this.client.rest.methods.fetchNote(id).then(data => {
      if (cache) this.cache.set(id, data);
      return data;
    });
  }
}

module.exports = UserNoteManager;
