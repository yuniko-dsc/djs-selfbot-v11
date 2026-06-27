'use strict';

const Collection = require('../util/Collection');
const BaseManager = require('./BaseManager');
const { RelationshipTypes } = require('../util/Constants');

/**
 * Manages API methods for Relationships and stores their cache.
 */
class RelationshipManager extends BaseManager {
  constructor(client, users) {
    super(client);
    this.cache = new Collection();
    this.friendNicknames = new Collection();
    this.sinceCache = new Collection();
    this._setup(users);
  }

  get friendCache() {
    const users = this.cache
      .filter(value => value === RelationshipTypes.FRIEND)
      .map((_, key) => [key, this.client.users.get(key)]);
    return new Collection(users);
  }

  get blockedCache() {
    const users = this.cache
      .filter(value => value === RelationshipTypes.BLOCKED)
      .map((_, key) => [key, this.client.users.get(key)]);
    return new Collection(users);
  }

  get incomingCache() {
    const users = this.cache
      .filter(value => value === RelationshipTypes.PENDING_INCOMING)
      .map((_, key) => [key, this.client.users.get(key)]);
    return new Collection(users);
  }

  get outgoingCache() {
    const users = this.cache
      .filter(value => value === RelationshipTypes.PENDING_OUTGOING)
      .map((_, key) => [key, this.client.users.get(key)]);
    return new Collection(users);
  }

  toJSON() {
    return this.cache.map((value, key) => ({
      id: key,
      type: RelationshipTypes[value],
      nickname: this.friendNicknames.get(key),
      since: this.sinceCache.get(key) ? this.sinceCache.get(key).toISOString() : null,
    }));
  }

  _setup(users) {
    if (!Array.isArray(users)) return;
    for (const relationShip of users) {
      this.friendNicknames.set(relationShip.id, relationShip.nickname);
      this.cache.set(relationShip.id, relationShip.type);
      this.sinceCache.set(relationShip.id, new Date(relationShip.since || 0));
    }
  }

  resolveUsername(user) {
    if (typeof user === 'object' && user.username) return user.username;
    return user;
  }

  fetch(user, { force = false } = {}) {
    const fetchAll = () => this.client.rest.methods.fetchRelationships().then(data => {
      this._setup(data);
      return user ? this.cache.get(this.resolveId(user)) : this;
    });

    if (user) {
      const id = this.resolveId(user);
      if (!force && this.cache.has(id)) return Promise.resolve(this.cache.get(id));
      return fetchAll();
    }
    return fetchAll();
  }

  deleteRelationship(user) {
    const id = this.resolveId(user);
    if (![RelationshipTypes.FRIEND, RelationshipTypes.BLOCKED, RelationshipTypes.PENDING_OUTGOING]
      .includes(this.cache.get(id))) {
      return Promise.resolve(false);
    }
    return this.client.rest.methods.removeFriend({ id }).then(() => true);
  }

  sendFriendRequest(options) {
    const id = this.resolveId(options);
    if (id) {
      return this.client.rest.methods.addFriend({ id }).then(() => true);
    }
    const username = this.resolveUsername(options);
    return this.client.rest.methods.sendFriendRequestByUsername(username).then(() => true);
  }

  addFriend(user) {
    const id = this.resolveId(user);
    if (this.cache.get(id) === RelationshipTypes.FRIEND) return Promise.resolve(false);
    if (this.cache.get(id) === RelationshipTypes.PENDING_OUTGOING) return Promise.resolve(false);
    return this.client.rest.methods.acceptFriendRequest({ id }).then(() => true);
  }

  setNickname(user, nickname = null) {
    const id = this.resolveId(user);
    if (this.cache.get(id) !== RelationshipTypes.FRIEND) return Promise.resolve(false);
    return this.client.rest.methods.setFriendNickname({ id }, nickname).then(() => {
      if (nickname) this.friendNicknames.set(id, nickname);
      else this.friendNicknames.delete(id);
      return true;
    });
  }

  addBlocked(user) {
    const id = this.resolveId(user);
    if (this.cache.get(id) === RelationshipTypes.BLOCKED) return Promise.resolve(false);
    return this.client.rest.methods.blockUser({ id }).then(() => true);
  }
}

module.exports = RelationshipManager;
