'use strict';

const Collection = require('../util/Collection');
const BaseManager = require('./BaseManager');

/**
 * Represents a single Discord quest.
 */
class Quest {
  constructor(data) {
    this.id = data.id;
    this.config = data.config;
    this.userStatus = data.user_status;
    this._raw = data;
  }

  get raw() {
    return this._raw;
  }

  isExpired(date = new Date()) {
    if (!this.config.expires_at) return false;
    return new Date(this.config.expires_at) < date;
  }

  isCompleted() {
    return this.userStatus && this.userStatus.completed_at != null;
  }

  hasClaimedRewards() {
    return this.userStatus && this.userStatus.claimed_at != null;
  }

  isEnrolledQuest() {
    return this.userStatus && this.userStatus.enrolled_at != null;
  }

  updateUserStatus(status) {
    if (!status) return;
    if (status.user_status) {
      this.updateUserStatus(status.user_status);
      return;
    }
    const previous = this.userStatus || {};
    this.userStatus = Object.assign({}, previous, status);
    if (status.progress) {
      this.userStatus.progress = Object.assign({}, previous.progress);
      for (const [task, data] of Object.entries(status.progress)) {
        this.userStatus.progress[task] = Object.assign({}, previous.progress && previous.progress[task], data);
      }
    }
    this._raw.user_status = this.userStatus;
  }
}

/**
 * Manages Discord quest API methods.
 * @extends {BaseManager}
 */
class QuestManager extends BaseManager {
  constructor(client) {
    super(client);
    this.cache = new Collection();
    this.Quest = Quest;
  }

  get() {
    return this.client.rest.methods.fetchQuests().then(data => {
      if (data.quests) {
        this.cache.clear();
        data.quests.forEach(questData => {
          this.cache.set(questData.id, new Quest(questData));
        });
      }
      return data;
    });
  }

  orbs() {
    return this.client.rest.methods.fetchVirtualCurrencyBalance();
  }

  getQuest(id) {
    return this.cache.get(id);
  }

  list() {
    return this.cache.array();
  }

  getExpired(date = new Date()) {
    return this.list().filter(quest => quest.isExpired(date));
  }

  getCompleted() {
    return this.list().filter(quest => quest.isCompleted());
  }

  getClaimable() {
    return this.list().filter(quest => quest.isCompleted() && !quest.hasClaimedRewards());
  }

  filterQuestsValid() {
    return this.list().filter(quest => !quest.isCompleted() && !quest.isExpired());
  }

  acceptQuest(questId, options = {}) {
    return this.client.rest.methods.acceptQuest(questId, options).then(data => {
      const quest = this.getQuest(questId);
      if (quest && data) quest.updateUserStatus(data);
      return quest;
    });
  }

  claimQuest(questId) {
    return this.client.rest.methods.claimQuest(questId).then(data => {
      const quest = this.getQuest(questId);
      if (quest && data) quest.updateUserStatus(data);
      return quest;
    });
  }

  watchVideo(questId, options = {}) {
    return this.client.rest.methods.questWatchVideo(questId, options);
  }

  streamOnDesktop(questId, options = {}) {
    return this.client.rest.methods.questStreamDesktop(questId, options);
  }
}

QuestManager.Quest = Quest;
module.exports = QuestManager;
