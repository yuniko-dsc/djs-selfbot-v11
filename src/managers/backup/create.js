'use strict';

const { fetchBuffer, fetchChannelPermissions, fetchTextChannelData, fetchVoiceChannelData } = require('./util');

async function getBans(guild) {
  const bans = [];
  const cases = await guild.fetchBans();
  cases.forEach(ban => bans.push({ id: ban.user.id, reason: ban.reason }));
  return bans;
}

async function getMembers(guild) {
  const members = [];
  guild.members.forEach(member => {
    members.push({
      userId: member.user.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      avatarUrl: member.user.avatarURL,
      joinedTimestamp: member.joinedTimestamp,
      roles: member.roles.map(role => role.id),
      bot: member.user.bot,
    });
  });
  return members;
}

async function getRoles(guild) {
  const roles = [];
  guild.roles
    .filter(role => !role.managed)
    .sort((a, b) => b.position - a.position)
    .forEach(role => {
      roles.push({
        oldId: role.id,
        name: role.name,
        color: role.hexColor,
        hoist: role.hoist,
        permissions: role.permissions.toString(),
        mentionable: role.mentionable,
        position: role.position,
        isEveryone: guild.id === role.id,
      });
    });
  return roles;
}

async function getEmojis(guild, options) {
  const emojis = [];
  for (const emoji of guild.emojis.values()) {
    const emojiData = { name: emoji.name };
    if (options.saveImages === 'base64') {
      emojiData.base64 = (await fetchBuffer(emoji.url)).toString('base64');
    } else {
      emojiData.url = emoji.url;
    }
    emojis.push(emojiData);
  }
  return emojis;
}

async function fetchAnyChannelData(channel, options, client) {
  if (channel.type === 'text' || channel.type === 'news') {
    return fetchTextChannelData(channel, options, client);
  }
  return fetchVoiceChannelData(channel);
}

async function getChannels(guild, options) {
  const allChannels = guild.channels;
  const categories = allChannels.filter(ch => ch.type === 'category').sort((a, b) => a.position - b.position);

  const categoriesResult = await Promise.all(categories.map(async category => {
    const children = allChannels.filter(c => c.parentID === category.id).sort((a, b) => a.position - b.position);
    const childrenData = await Promise.all(children.map(child => fetchAnyChannelData(child, options, guild.client)));
    return {
      name: category.name,
      permissions: fetchChannelPermissions(category),
      children: childrenData,
    };
  }));

  const others = allChannels
    .filter(ch => !ch.parentID && ch.type !== 'category' && ch.type !== 'store')
    .sort((a, b) => a.position - b.position);

  const othersResult = await Promise.all(others.map(ch => fetchAnyChannelData(ch, options, guild.client)));

  return { categories: categoriesResult, others: othersResult };
}

module.exports = { getBans, getMembers, getRoles, getEmojis, getChannels };
