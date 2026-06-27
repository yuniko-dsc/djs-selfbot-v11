const Action = require('./Action');
const Constants = require('../../util/Constants');

class GuildMemberAddAction extends Action {
  handle(data) {
    const client = this.client;
    const guild = client.guilds.get(data.guild_id);
    if (guild) {
      guild.memberCount++;
      // _addMember with emitEvent=false to prevent double emission
      const member = guild._addMember(data, false);
      // Always emit the event when handling GUILD_MEMBER_ADD action
      if (client.status === Constants.Status.READY) {
        client.emit(Constants.Events.GUILD_MEMBER_ADD, member);
      }
      return { guild, member };
    }
    return { guild: null, member: null };
  }
}

module.exports = GuildMemberAddAction;