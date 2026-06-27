'use strict';

const snekfetch = require('snekfetch');

async function fetchBuffer(url) {
  const res = await snekfetch.get(url);
  return res.body;
}

function fetchChannelPermissions(channel) {
  const permissions = [];
  if (!channel.permissionOverwrites) return permissions;
  channel.permissionOverwrites.forEach(perm => {
    if (perm.type === 'role') {
      const role = channel.guild.roles.get(perm.id);
      if (role) {
        permissions.push({
          roleName: role.name,
          allow: perm.allow.toString(),
          deny: perm.deny.toString(),
        });
      }
    }
  });
  return permissions;
}

async function fetchVoiceChannelData(channel) {
  return {
    type: 'GUILD_VOICE',
    name: channel.name,
    bitrate: channel.bitrate,
    userLimit: channel.userLimit,
    parent: channel.parent ? channel.parent.name : null,
    permissions: fetchChannelPermissions(channel),
  };
}

async function fetchChannelMessages(channel, options, client) {
  const messages = [];
  const maxMessages = Number.isNaN(options.maxMessagesPerChannel) ? 10 : options.maxMessagesPerChannel;
  let before = null;
  const imageRegex = /\.(png|jpg|jpeg|jpe|jif|jfif|jfi)$/i;

  while (messages.length < maxMessages) {
    const fetched = await client.rest.methods.fetchMessages(channel, { limit: 100, before });
    if (!fetched || !fetched.size) break;

    const arr = fetched instanceof Map ? [...fetched.values()] : fetched;
    before = arr[arr.length - 1].id;

    for (const msg of arr) {
      if (messages.length >= maxMessages) break;
      if (!msg.author) continue;

      const files = await Promise.all((msg.attachments || []).map(async attachment => {
        let attach = attachment.url;
        if (options.saveImages === 'base64' && imageRegex.test(attachment.url)) {
          try {
            attach = (await fetchBuffer(attachment.url)).toString('base64');
          } catch (e) { /* ignore */ }
        }
        return { name: attachment.filename || attachment.name, attachment: attach };
      }));

      messages.push({
        username: msg.author.username,
        avatar: msg.author.displayAvatarURL,
        content: msg.content,
        embeds: msg.embeds || [],
        files,
        pinned: msg.pinned,
        sentAt: msg.createdAt.toISOString(),
      });
    }

    if (arr.length < 100) break;
  }

  return messages;
}

async function fetchTextChannelData(channel, options, client) {
  const channelData = {
    type: channel.type === 'news' ? 'GUILD_NEWS' : 'GUILD_TEXT',
    name: channel.name,
    nsfw: channel.nsfw,
    rateLimitPerUser: channel.rateLimitPerUser,
    parent: channel.parent ? channel.parent.name : null,
    topic: channel.topic,
    permissions: fetchChannelPermissions(channel),
    messages: [],
    isNews: channel.type === 'news',
    threads: [],
  };

  try {
    channelData.messages = await fetchChannelMessages(channel, options, client);
  } catch (e) { /* ignore */ }

  return channelData;
}

async function loadCategory(categoryData, guild) {
  const category = await guild.createChannel(categoryData.name, 'category');
  const finalPermissions = [];
  categoryData.permissions.forEach(perm => {
    const role = guild.roles.find(r => r.name === perm.roleName);
    if (role) {
      finalPermissions.push({ id: role.id, allow: perm.allow, deny: perm.deny, type: 'role' });
    }
  });
  if (finalPermissions.length) {
    await guild.client.rest.methods.updateChannelPermissions(category, finalPermissions);
  }
  return category;
}

async function loadChannel(channelData, guild, category, options, client) {
  const createOptions = { type: channelData.type === 'GUILD_VOICE' ? 'voice' : 'text', parent: category };
  if (channelData.type === 'GUILD_TEXT' || channelData.type === 'GUILD_NEWS') {
    createOptions.topic = channelData.topic;
    createOptions.nsfw = channelData.nsfw;
    createOptions.type = channelData.isNews ? 'news' : 'text';
  } else if (channelData.type === 'GUILD_VOICE') {
    createOptions.bitrate = channelData.bitrate;
    createOptions.userLimit = channelData.userLimit;
    createOptions.type = 'voice';
  }

  const channel = await guild.createChannel(channelData.name, createOptions.type, createOptions);
  return channel;
}

async function clearGuild(guild) {
  guild.roles.filter(role => !role.managed && role.editable && role.id !== guild.id).forEach(role => {
    role.delete().catch(() => {});
  });
  guild.channels.forEach(channel => channel.delete().catch(() => {}));
  guild.emojis.forEach(emoji => emoji.delete().catch(() => {}));
  return guild.fetchBans().then(bans => {
    bans.forEach(ban => guild.unban(ban.user).catch(() => {}));
  }).catch(() => {});
}

module.exports = {
  fetchBuffer,
  fetchChannelPermissions,
  fetchVoiceChannelData,
  fetchChannelMessages,
  fetchTextChannelData,
  loadCategory,
  loadChannel,
  clearGuild,
};
