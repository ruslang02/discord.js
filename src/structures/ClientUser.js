'use strict';

const ClientUserSettings = require('./ClientUserSettings');
const Constants = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const Structures = require('../util/Structures');

/**
 * Represents the logged in client's Discord user.
 * @extends {User}
 */
class ClientUser extends Structures.get('User') {
  constructor(client, data) {
    super(client, data.user);
    this._typing = new Map();
    /**
     * Various settings for this user
     * <warn>This is only filled when using a user account.</warn>
     * @type {?ClientUserSettings}
     * @deprecated
     */
    this.settings = data.user_settings ? new ClientUserSettings(this, data.user_settings) : null;
  }

  _patch(data) {
    super._patch(data);
    if ('verified' in data) {
      /**
       * Whether or not this account has been verified
       * @type {boolean}
       */
      this.verified = data.verified;
    }

    if ('mfa_enabled' in data) {
      /**
       * If the bot's {@link ClientApplication#owner Owner} has MFA enabled on their account
       * @type {?boolean}
       */
      this.mfaEnabled = typeof data.mfa_enabled === 'boolean' ? data.mfa_enabled : null;
    } else if (typeof this.mfaEnabled === 'undefined') {
      this.mfaEnabled = null;
    }

    if ('email' in data) {
      /**
       * The email of this account
       * <warn>This is only filled when using a user account.</warn>
       * @type {?string}
       */
      this.email = typeof data.email === 'string' ? data.email : null;
    }

    if ('premium' in data) {
      /**
       * If the user has Discord premium (nitro)
       * <warn>This is only filled when using a user account.</warn>
       * @type {?boolean}
       */
      this.premium = typeof data.premium === 'boolean' ? data.premium : null;
    }
    if (data.token) this.client.token = data.token;
  }

  /**
   * ClientUser's custom status
   * @type {CustomStatus}
   * @readonly
   */
  get customStatus() {
    return this.settings.customStatus;
  }

  /**
   * ClientUser's presence
   * @type {Presence}
   * @readonly
   */
  get presence() {
    return this.client.presence;
  }

  /**
   * Accepts an invite to join a guild.
   * <warn>This is only available when using a user account.</warn>
   * @param {Invite|string} code Invite or code to accept
   * @returns {Promise<Guild>} Joined guild
   */
  acceptInvite(code) {
    if (code.id) code = code.id;
    return new Promise((resolve, reject) =>
      this.client.api
        .invite(code)
        .post()
        .then(res => {
          const handler = guild => {
            if (guild.id === res.id) {
              resolve(guild);
              this.client.removeListener(Constants.Events.GUILD_CREATE, handler);
            }
          };
          this.client.on(Constants.Events.GUILD_CREATE, handler);
          this.client.setTimeout(() => {
            this.client.removeListener(Constants.Events.GUILD_CREATE, handler);
            reject(new Error('Accepting invite timed out'));
          }, 120e3);
        })
        .catch(() => reject(new Error('Invite code is not valid'))),
    );
  }

  edit(data) {
    return this.client.api
      .users('@me')
      .patch({ data })
      .then(newData => {
        this.client.token = newData.token;
        const { updated } = this.client.actions.UserUpdate.handle(newData);
        if (updated) return updated;
        return this;
      });
  }

  /**
   * Sets the username of the logged in client.
   * <info>Changing usernames in Discord is heavily rate limited, with only 2 requests
   * every hour. Use this sparingly!</info>
   * @param {string} username The new username
   * @returns {Promise<ClientUser>}
   * @example
   * // Set username
   * client.user.setUsername('discordjs')
   *   .then(user => console.log(`My new username is ${user.username}`))
   *   .catch(console.error);
   */
  setUsername(username) {
    return this.edit({ username });
  }

  /**
   * Sets the avatar of the logged in client.
   * @param {BufferResolvable|Base64Resolvable} avatar The new avatar
   * @returns {Promise<ClientUser>}
   * @example
   * // Set avatar
   * client.user.setAvatar('./avatar.png')
   *   .then(user => console.log(`New avatar set!`))
   *   .catch(console.error);
   */
  async setAvatar(avatar) {
    return this.edit({ avatar: await DataResolver.resolveImage(avatar) });
  }

  /**
   * Data resembling a raw Discord presence.
   * @typedef {Object} CustomStatus
   * @property {string?} [text] Text shown on the status
   * @property {string?} [expires_at] String representation of Date when the status should clear
   * @property {string?} [emoji_name] Name of the emoji
   * @property {Snowflake?} [emoji_id] Snowflake of the emoji
   */

  /**
   * Sets the full presence of the client user.
   * @param {CustomStatus} data Data for the presence
   * @returns {Promise<Object>}
   * @example
   * // Set the client user's custom status
   * client.user.setCustomStatus({ text: "Happy", emoji_name: "😀" })
   *   .then(console.log)
   *   .catch(console.error);
   */
  async setCustomStatus(data) {
    await this.client.presence.set({
      activities: [
        {
          type: 4,
          state: data.text || null,
          name: 'Custom Status',
          emoji: {
            id: data.emoji_id || null,
            name: data.emoji_name || null,
            animated: false,
          },
        },
      ],
    });
    const newSettings = await this.settings.update('custom_status', data);
    this.settings._patch(newSettings);
    return newSettings;
  }

  /**
   * Data resembling a raw Discord presence.
   * @typedef {Object} PresenceData
   * @property {PresenceStatusData} [status] Status of the user
   * @property {boolean} [afk] Whether the user is AFK
   * @property {Object} [activity] Activity the user is playing
   * @property {Object|string} [activity.application] An application object or application id
   * @property {string} [activity.application.id] The id of the application
   * @property {string} [activity.name] Name of the activity
   * @property {ActivityType|number} [activity.type] Type of the activity
   * @property {string} [activity.url] Stream url
   * @property {?number|number[]} [shardID] Shard Id(s) to have the activity set on
   */

  /**
   * Sets the full presence of the client user.
   * @param {PresenceData} data Data for the presence
   * @returns {Promise<Presence>}
   * @example
   * // Set the client user's presence
   * client.user.setPresence({ activity: { name: 'with discord.js' }, status: 'idle' })
   *   .then(console.log)
   *   .catch(console.error);
   */
  setPresence(data) {
    return this.client.presence.set(data);
  }

  /**
   * A user's status. Must be one of:
   * * `online`
   * * `idle`
   * * `invisible`
   * * `dnd` (do not disturb)
   * @typedef {string} PresenceStatusData
   */

  /**
   * Sets the status of the client user.
   * @param {PresenceStatusData} status Status to change to
   * @param {?number|number[]} [shardID] Shard ID(s) to have the activity set on
   * @returns {Promise<Presence>}
   * @example
   * // Set the client user's status
   * client.user.setStatus('idle')
   *   .then(console.log)
   *   .catch(console.error);
   */
  setStatus(status, shardID) {
    return this.setPresence({ status, shardID });
  }

  /**
   * Options for setting an activity
   * @typedef ActivityOptions
   * @type {Object}
   * @property {string} [url] Twitch stream URL
   * @property {ActivityType|number} [type] Type of the activity
   * @property {?number|number[]} [shardID] Shard Id(s) to have the activity set on
   */

  /**
   * Sets the activity the client user is playing.
   * @param {string|ActivityOptions} [name] Activity being played, or options for setting the activity
   * @param {ActivityOptions} [options] Options for setting the activity
   * @returns {Promise<Presence>}
   * @example
   * // Set the client user's activity
   * client.user.setActivity('discord.js', { type: 'WATCHING' })
   *   .then(presence => console.log(`Activity set to ${presence.activities[0].name}`))
   *   .catch(console.error);
   */
  setActivity(name, options = {}) {
    if (!name) return this.setPresence({ activity: null, shardID: options.shardID });

    const activity = Object.assign({}, options, typeof name === 'object' ? name : { name });
    return this.setPresence({ activity, shardID: activity.shardID });
  }

  /**
   * Sets/removes the AFK flag for the client user.
   * @param {boolean} afk Whether or not the user is AFK
   * @returns {Promise<Presence>}
   */
  setAFK(afk) {
    return this.setPresence({ afk });
  }
}

module.exports = ClientUser;
