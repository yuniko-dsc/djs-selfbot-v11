'use strict';

const { loadCategory, loadChannel, clearGuild } = require('./util');

async function loadConfig(guild, backupData) {
  const configPromises = [];
  if (backupData.name) configPromises.push(guild.setName(backupData.name));
  if (backupData.iconBase64) {
    configPromises.push(guild.setIcon(Buffer.from(backupData.iconBase64, 'base64')));
  } else if (backupData.iconURL) {
    configPromises.push(guild.setIcon(backupData.iconURL));
  }
  if (backupData.splashBase64) {
    configPromises.push(guild.setSplash(Buffer.from(backupData.splashBase64, 'base64')));
  } else if (backupData.splashURL) {
    configPromises.push(guild.setSplash(backupData.splashURL));
  }
  if (backupData.bannerBase64) {
    configPromises.push(guild.setBanner(Buffer.from(backupData.bannerBase64, 'base64')));
  } else if (backupData.bannerURL) {
    configPromises.push(guild.setBanner(backupData.bannerURL));
  }
  if (backupData.verificationLevel) {
    configPromises.push(guild.setVerificationLevel(backupData.verificationLevel));
  }
  if (backupData.defaultMessageNotifications) {
    configPromises.push(guild.setDefaultMessageNotifications(backupData.defaultMessageNotifications));
  }
  await Promise.all(configPromises);
}

async function loadRoles(guild, backupData) {
  const rolePromises = [];
  backupData.roles.forEach(roleData => {
    if (roleData.isEveryone) {
      rolePromises.push(guild.roles.get(guild.id).edit({
        name: roleData.name,
        color: roleData.color,
        permissions: roleData.permissions,
        mentionable: roleData.mentionable,
      }));
    } else {
      rolePromises.push(guild.createRole({
        name: roleData.name,
        color: roleData.color,
        hoist: roleData.hoist,
        permissions: roleData.permissions,
        mentionable: roleData.mentionable,
      }));
    }
  });
  await Promise.all(rolePromises);
}

async function loadChannels(guild, backupData, options) {
  const loadChannelPromises = [];
  backupData.channels.categories.forEach(categoryData => {
    if (!categoryData.name) return;
    loadChannelPromises.push((async () => {
      const createdCategory = await loadCategory(categoryData, guild);
      await Promise.all(
        categoryData.children
          .filter(channelData => channelData.name)
          .map(channelData => loadChannel(channelData, guild, createdCategory, options, guild.client)),
      );
    })());
  });
  backupData.channels.others.forEach(channelData => {
    if (!channelData.name) return;
    loadChannelPromises.push(loadChannel(channelData, guild, null, options, guild.client));
  });
  await Promise.all(loadChannelPromises);
}

async function loadBans(guild, backupData) {
  await Promise.all(backupData.bans.map(ban => guild.ban({ id: ban.id }, { reason: ban.reason }).catch(() => {})));
}

async function loadEmojis(guild, backupData) {
  await Promise.all(backupData.emojis.map(emoji => {
    if (emoji.base64) {
      return guild.createEmoji(Buffer.from(emoji.base64, 'base64'), emoji.name).catch(() => {});
    }
    return guild.createEmoji(emoji.url, emoji.name).catch(() => {});
  }));
}

module.exports = { loadConfig, loadRoles, loadChannels, loadBans, loadEmojis, clearGuild };
