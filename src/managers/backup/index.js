'use strict';

const Snowflake = require('../../util/Snowflake');
const createMaster = require('./create');
const loadMaster = require('./load');
const { clearGuild, fetchBuffer } = require('./util');

async function create(guild, options = {}) {
  const normalizedOptions = Object.assign({
    backupID: null,
    maxMessagesPerChannel: 10,
    doNotBackup: ['bans', 'emojis'],
    backupMembers: false,
    saveImages: '',
  }, options, {
    backupID: options.backupID || options.backupId || null,
  });

  const backupData = {
    name: guild.name,
    verificationLevel: guild.verificationLevel,
    explicitContentFilter: guild.explicitContentFilter,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    channels: { categories: [], others: [] },
    roles: [],
    bans: [],
    emojis: [],
    members: [],
    createdTimestamp: Date.now(),
    guildID: guild.id,
    id: normalizedOptions.backupID || Snowflake.generate(),
  };

  if (guild.iconURL) {
    if (normalizedOptions.saveImages === 'base64') {
      backupData.iconBase64 = (await fetchBuffer(guild.iconURL)).toString('base64');
    }
    backupData.iconURL = guild.iconURL;
  }

  if (guild.splashURL) {
    if (normalizedOptions.saveImages === 'base64') {
      backupData.splashBase64 = (await fetchBuffer(guild.splashURL)).toString('base64');
    }
    backupData.splashURL = guild.splashURL;
  }

  if (normalizedOptions.backupMembers) {
    backupData.members = await createMaster.getMembers(guild);
  }
  if (!normalizedOptions.doNotBackup.includes('bans')) {
    backupData.bans = await createMaster.getBans(guild);
  }
  if (!normalizedOptions.doNotBackup.includes('roles')) {
    backupData.roles = await createMaster.getRoles(guild);
  }
  if (!normalizedOptions.doNotBackup.includes('emojis')) {
    backupData.emojis = await createMaster.getEmojis(guild, normalizedOptions);
  }
  if (!normalizedOptions.doNotBackup.includes('channels')) {
    backupData.channels = await createMaster.getChannels(guild, normalizedOptions);
  }

  return backupData;
}

async function load(backupData, guild, options = {}) {
  if (!guild) throw new Error('Invalid guild');
  const normalizedOptions = Object.assign({ clearGuildBeforeRestore: true, maxMessagesPerChannel: 10 }, options);

  if (normalizedOptions.clearGuildBeforeRestore) {
    await clearGuild(guild);
  }

  await Promise.all([loadMaster.loadConfig(guild, backupData), loadMaster.loadRoles(guild, backupData)]);
  await new Promise(resolve => setTimeout(resolve, 3000));
  await loadMaster.loadChannels(guild, backupData, normalizedOptions);

  const restorePromises = [];
  if (!normalizedOptions.doNotBackup || !normalizedOptions.doNotBackup.includes('emojis')) {
    restorePromises.push(loadMaster.loadEmojis(guild, backupData));
  }
  if (!normalizedOptions.doNotBackup || !normalizedOptions.doNotBackup.includes('bans')) {
    restorePromises.push(loadMaster.loadBans(guild, backupData));
  }
  await Promise.all(restorePromises);
  return backupData;
}

module.exports = { create, load };
