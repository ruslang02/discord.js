'use strict';

module.exports = (client, packet) => {
  client.user.settings._patch(packet.d);
  client.actions.UserSettingsUpdate.handle(packet.d);
};
