const AbstractHandler = require('./AbstractHandler');
const Constants = require('../../../../util/Constants');

class GuildMemberAddHandler extends AbstractHandler {
  handle(packet) {
    const client = this.packetManager.client;
    const data = packet.d;
    const guild = client.guilds.get(data.guild_id);
    if (guild) {
      guild.memberCount++;
      const member = guild.members._add ? guild.members._add(data) : guild._addMember(data, false);
      if (client.ws.connection.status === Constants.Status.READY) {
        /**
         * Emitted whenever a user joins a guild.
         * @event Client#guildMemberAdd
         * @param {GuildMember} member The member that has joined a guild
         */
        client.emit(Constants.Events.GUILD_MEMBER_ADD, member);
      }
    }
  }
}

module.exports = GuildMemberAddHandler;