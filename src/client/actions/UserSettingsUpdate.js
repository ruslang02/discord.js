'use strict';

const Action = require('./Action');
const { Events } = require('../../util/Constants');

class UserSettingsUpdateAction extends Action {
  handle(settings) {
    const client = this.client;
    /**
     * Emitted whenever a user's details (e.g. username) are changed.
     * @event Client#userSettingsUpdate
     * @param {ClientUserSettings} oldUser The user before the update
     */
    client.emit(Events.USER_SETTINGS_UPDATE, settings);
    return { settings };
  }
}

module.exports = UserSettingsUpdateAction;
