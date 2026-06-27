const Collection = require('../../../../util/Collection');
const { Events, Status } = require('../../../../util/Constants');
const AbstractHandler = require('./AbstractHandler');
// Uncomment in v12
// const Collection = require('../../../../util/Collection');

class GuildMemberListUpdate extends AbstractHandler {
  handle(packet) {
  const client = this.packetManager.client;
  const data = packet.d;
  const guild = client.guilds.get(data.guild_id);
  if (!guild) return;
  const members = new Collection();
  // Get Member from side Discord Channel (online counting if large server)
  for (const object of data.ops) {
    if (object.op == 'SYNC') {
      for (const member_ of object.items) {
        const member = member_.member;
        if (!member) continue;
        members.set(member.user.id, guild._addMember(member, false));
        if (member.presence) {
          guild._setPresence(Object.assign(member.presence, { guild }));
        }
      }
    } else if (object.op == 'INVALIDATE') {
      client.emit(Events.DEBUG, `Invalidate [${object.range[0]}, ${object.range[1]}]`);
    } else if (object.op == 'UPDATE' || object.op == 'INSERT') {
      const member = object.item.member;
      if (!member) continue;
      const wasExisting = guild.members.has(member.user.id);
      const guildMember = guild._addMember(member, false);
      members.set(member.user.id, guildMember);
      if (member.presence) {
        guild._setPresence(member.user.id, member.presence)
      }
      // Emit guildMemberAdd when a new member is inserted (not just updated)
      if (object.op == 'INSERT' && !wasExisting && client.status === Status.READY) {
        client.emit(Events.GUILD_MEMBER_ADD, guildMember);
      }
    } else if (object.op == 'DELETE') {
      // Nothing;
    }
  }
  client.emit(Events.GUILD_MEMBER_LIST_UPDATE, members, guild, data);
  }
}

module.exports = GuildMemberListUpdate;
