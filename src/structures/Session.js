'use strict';

/**
 * Represents an active auth session.
 */
class Session {
  constructor(data) {
    this.idHash = data.id_hash || data.id;
    this.id = data.id_hash || data.id;
    this.clientInfo = data.client_info || data.client;
    this.os = data.client_info ? data.client_info.os : data.os;
    this.browser = data.client_info ? data.client_info.browser : data.browser;
    this.device = data.client_info ? data.client_info.device : data.device;
    this.approxLastUsed = data.approx_last_used_time ? new Date(data.approx_last_used_time) : null;
    this.current = Boolean(data.current);
  }
}

module.exports = Session;
