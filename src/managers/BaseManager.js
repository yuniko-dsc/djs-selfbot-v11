'use strict';

/**
 * Manages the API methods of a data model.
 * @abstract
 */
class BaseManager {
  constructor(client) {
    Object.defineProperty(this, 'client', { value: client });
  }

  /**
   * Resolves a UserResolvable to a user id.
   * @param {UserResolvable} user
   * @returns {?Snowflake}
   */
  resolveId(user) {
    if (!user) return null;
    if (typeof user === 'string') return user.match(/\d{17,19}/)?.[0] || null;
    if (user.id) return user.id;
    return null;
  }
}

module.exports = BaseManager;
