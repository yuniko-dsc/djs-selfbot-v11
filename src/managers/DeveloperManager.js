'use strict';

const Collection = require('../util/Collection');
const BaseManager = require('./BaseManager');
const OAuth2Application = require('../structures/OAuth2Application');
const Util = require('../util/Util');

/**
 * Manages developer application API methods.
 * @extends {BaseManager}
 */
class DeveloperManager extends BaseManager {
  get(withTeamApplications = true) {
    return this.client.rest.methods.fetchApplications(withTeamApplications).then(data => {
      const applications = new Collection();
      for (const app of data) {
        applications.set(app.id, new OAuth2Application(this.client, app));
      }
      return applications;
    });
  }

  list(withTeamApplications = true) {
    return this.get(withTeamApplications);
  }

  fetch(applicationId) {
    return this.client.rest.methods.fetchApplicationById(applicationId).then(
      data => new OAuth2Application(this.client, data),
    );
  }

  edit(applicationId, data) {
    const _data = {};
    if (data.name) _data.name = data.name;
    if (data.description !== undefined) _data.description = data.description;
    if (data.icon !== undefined) {
      return Util.resolveImage(data.icon).then(icon => {
        _data.icon = icon;
        return this.client.rest.methods.editApplication(applicationId, _data);
      }).then(result => new OAuth2Application(this.client, result));
    }
    if (data.tags) _data.tags = data.tags;
    if (data.interactionsEndpointUrl !== undefined) _data.interactions_endpoint_url = data.interactionsEndpointUrl;
    if (data.roleConnectionsVerificationUrl !== undefined) {
      _data.role_connections_verification_url = data.roleConnectionsVerificationUrl;
    }
    if (data.termsOfServiceUrl !== undefined) _data.terms_of_service_url = data.termsOfServiceUrl;
    if (data.privacyPolicyUrl !== undefined) _data.privacy_policy_url = data.privacyPolicyUrl;
    return this.client.rest.methods.editApplication(applicationId, _data)
      .then(result => new OAuth2Application(this.client, result));
  }

  setAvatar(applicationId, avatar) {
    return this.edit(applicationId, { icon: avatar });
  }

  delete(applicationId) {
    return this.client.rest.methods.deleteApplication(applicationId);
  }

  create(data) {
    return this.client.rest.methods.createApplication(data)
      .then(result => new OAuth2Application(this.client, result));
  }
}

module.exports = DeveloperManager;
