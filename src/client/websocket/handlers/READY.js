'use strict';

let ClientUser;

module.exports = (client, { d: data }, shard) => {
  if (client.user) {
    client.user._patch(data);
  } else {
    if (!ClientUser) ClientUser = require('../../../structures/ClientUser');
    const clientUser = new ClientUser(client, data);
    client.user = clientUser;
    client.users.cache.set(clientUser.id, clientUser);
  }

  for (const guild of data.guilds) {
    guild.shardID = shard.id;
    client.guilds.add(guild);
  }
  for (const privateDM of data.private_channels) {
    client.channels.add(privateDM);
  }

  shard.checkReady();
};
