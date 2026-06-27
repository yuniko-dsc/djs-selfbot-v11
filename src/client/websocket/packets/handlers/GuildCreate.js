const AbstractHandler = require('./AbstractHandler');
const Constants = require('../../../../util/Constants');

class GuildCreateHandler extends AbstractHandler {
  handle(packet) {
    const client = this.packetManager.client;
    const data = packet.d;

    const guild = client.guilds.get(data.id);
    if (guild) {
      if (!guild.available && !data.unavailable) {
        // A newly available guild
        guild.setup(data);
        this.packetManager.ws.checkIfReady();
      }
    } else {
      // A new guild - subscribe to member updates
      client.dataManager.newGuild(data);
      
      // Subscribe to member updates to receive GUILD_MEMBER_ADD events
      if (client.status === Constants.Status.READY) {
        client.ws.send({
          op: Constants.OPCodes.LAZY_REQUEST,
          d: {
            guild_id: data.id,
            typing: true,
            threads: true,
            activities: true,
            member_updates: true,
            thread_member_lists: [],
            members: [],
            channels: {},
          },
        });
      }
    }
  }
}

module.exports = GuildCreateHandler;
