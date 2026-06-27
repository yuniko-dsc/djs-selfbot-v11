const BitField = require('./BitField');
const util = require('util');

const bit = n => BigInt(n);

/**
 * Data structure that makes it easy to interact with a permission bitfield. All {@link GuildMember}s have a set of
 * permissions in their guild, and each channel in the guild may also have {@link PermissionOverwrites} for the member
 * that override their default permissions.
 * @extends {BitField}
 */
class Permissions extends BitField {
  /**
   * @param {GuildMember} [member] Member the permissions are for **(deprecated)**
   * @param {number|PermissionResolvable} permissions Permissions or bitfield to read from
   */
  constructor(member, permissions) {
    super(typeof member === 'object' && !(member instanceof Array) ? permissions : member);

    Object.defineProperty(this, '_member', {
      writable: true,
      value: typeof member === 'object' && !(member instanceof Array) ? member : null,
    });
  }

  /**
     * Member the permissions are for
     * @type {GuildMember}
     * @deprecated
     */
  get member() {
    return this._member;
  }

  set member(value) {
    this._member = value;
  }

  /**
   * Bitfield of the packed permissions
   * @type {number}
   * @see {@link Permissions#bitfield}
   * @deprecated
   * @readonly
   */
  get raw() {
    return this.bitfield;
  }

  set raw(raw) {
    this.bitfield = raw;
  }

  /**
   * Checks whether the bitfield has a permission, or any of multiple permissions.
   * @param {PermissionResolvable} permission Permission(s) to check for
   * @param {boolean} [checkAdmin=true] Whether to allow the administrator permission to override
   * @returns {boolean}
   */
  any(permission, checkAdmin = true) {
    return (checkAdmin && super.has(this.constructor.FLAGS.ADMINISTRATOR)) || super.any(permission);
  }

  /**
   * Checks whether the bitfield has a permission, or multiple permissions.
   * @param {PermissionResolvable} permission Permission(s) to check for
   * @param {boolean} [checkAdmin=true] Whether to allow the administrator permission to override
   * @returns {boolean}
   */
  has(permission, checkAdmin = true) {
    return (checkAdmin && super.has(this.constructor.FLAGS.ADMINISTRATOR)) || super.has(permission);
  }

  /**
   * Checks whether the user has a certain permission, e.g. `READ_MESSAGES`.
   * @param {PermissionResolvable} permission The permission to check for
   * @param {boolean} [explicit=false] Whether to require the user to explicitly have the exact permission
   * @returns {boolean}
   * @see {@link Permissions#has}
   * @deprecated
   */
  hasPermission(permission, explicit = false) {
    return this.has(permission, !explicit);
  }

  /**
   * Checks whether the user has all specified permissions.
   * @param {PermissionResolvable} permissions The permissions to check for
   * @param {boolean} [explicit=false] Whether to require the user to explicitly have the exact permissions
   * @returns {boolean}
   * @see {@link Permissions#has}
   * @deprecated
   */
  hasPermissions(permissions, explicit = false) {
    return this.has(permissions, !explicit);
  }

  /**
   * Checks whether the user has all specified permissions, and lists any missing permissions.
   * @param {PermissionResolvable} permissions The permissions to check for
   * @param {boolean} [explicit=false] Whether to require the user to explicitly have the exact permissions
   * @returns {PermissionResolvable}
   * @see {@link Permissions#missing}
   * @deprecated
   */
  missingPermissions(permissions, explicit = false) {
    return this.missing(permissions, !explicit);
  }
}

/**
 * Data that can be resolved to give a permission number. This can be:
 * * A string (see {@link Permissions.FLAGS})
 * * A permission number
 * @typedef {string|number|Permissions|PermissionResolvable[]} PermissionResolvable
 */

/**
 * Numeric permission flags. All available properties:
 * - `ADMINISTRATOR` (implicitly has *all* permissions, and bypasses all channel overwrites)
 * - `CREATE_INSTANT_INVITE` (create invitations to the guild)
 * - `KICK_MEMBERS`
 * - `BAN_MEMBERS`
 * - `MANAGE_CHANNELS` (edit and reorder channels)
 * - `MANAGE_GUILD` (edit the guild information, region, etc.)
 * - `ADD_REACTIONS` (add new reactions to messages)
 * - `VIEW_AUDIT_LOG`
 * - `PRIORITY_SPEAKER`
 * - `STREAM`
 * - `VIEW_CHANNEL`
 * - `SEND_MESSAGES`
 * - `SEND_TTS_MESSAGES`
 * - `MANAGE_MESSAGES` (delete messages and reactions)
 * - `EMBED_LINKS` (links posted will have a preview embedded)
 * - `ATTACH_FILES`
 * - `READ_MESSAGE_HISTORY` (view messages that were posted prior to opening Discord)
 * - `MENTION_EVERYONE`
 * - `USE_EXTERNAL_EMOJIS` (use emojis from different guilds)
 * - `EXTERNAL_EMOJIS` **(deprecated)**
 * - `CONNECT` (connect to a voice channel)
 * - `SPEAK` (speak in a voice channel)
 * - `MUTE_MEMBERS` (mute members across all voice channels)
 * - `DEAFEN_MEMBERS` (deafen members across all voice channels)
 * - `MOVE_MEMBERS` (move members between voice channels)
 * - `USE_VAD` (use voice activity detection)
 * - `CHANGE_NICKNAME`
 * - `MANAGE_NICKNAMES` (change other members' nicknames)
 * - `MANAGE_ROLES`
 * - `MANAGE_ROLES_OR_PERMISSIONS` **(deprecated)**
 * - `MANAGE_WEBHOOKS`
 * - `MANAGE_EMOJIS`
 * @type {Object}
 * @see {@link https://discordapp.com/developers/docs/topics/permissions}
 */
 Permissions.FLAGS = {
  CREATE_INSTANT_INVITE: bit(1) << bit(0),
  KICK_MEMBERS: bit(1) << bit(1),
  BAN_MEMBERS: bit(1) << bit(2),
  ADMINISTRATOR: bit(1) << bit(3),
  MANAGE_CHANNELS: bit(1) << bit(4),
  MANAGE_GUILD: bit(1) << bit(5),
  ADD_REACTIONS: bit(1) << bit(6),
  VIEW_AUDIT_LOG: bit(1) << bit(7),
  PRIORITY_SPEAKER: bit(1) << bit(8),
  STREAM: bit(1) << bit(9),
  VIEW_CHANNEL: bit(1) << bit(10),
  SEND_MESSAGES: bit(1) << bit(11),
  SEND_TTS_MESSAGES: bit(1) << bit(12),
  MANAGE_MESSAGES: bit(1) << bit(13),
  EMBED_LINKS: bit(1) << bit(14),
  ATTACH_FILES: bit(1) << bit(15),
  READ_MESSAGE_HISTORY: bit(1) << bit(16),
  MENTION_EVERYONE: bit(1) << bit(17),
  USE_EXTERNAL_EMOJIS: bit(1) << bit(18),
  VIEW_GUILD_INSIGHTS: bit(1) << bit(19),
  CONNECT: bit(1) << bit(20),
  SPEAK: bit(1) << bit(21),
  MUTE_MEMBERS: bit(1) << bit(22),
  DEAFEN_MEMBERS: bit(1) << bit(23),
  MOVE_MEMBERS: bit(1) << bit(24),
  USE_VAD: bit(1) << bit(25),
  CHANGE_NICKNAME: bit(1) << bit(26),
  MANAGE_NICKNAMES: bit(1) << bit(27),
  MANAGE_ROLES: bit(1) << bit(28),
  MANAGE_WEBHOOKS: bit(1) << bit(29),
  MANAGE_EMOJIS_AND_STICKERS: bit(1) << bit(30),
  USE_APPLICATION_COMMANDS: bit(1) << bit(31),
  REQUEST_TO_SPEAK: bit(1) << bit(32),
  MANAGE_THREADS: bit(1) << bit(34),
  USE_PUBLIC_THREADS: bit(1) << bit(35),
  USE_PRIVATE_THREADS: bit(1) << bit(36),
  USE_EXTERNAL_STICKERS: bit(1) << bit(37),
  SEND_MESSAGES_IN_THREADS: bit(1) << bit(38),
  START_EMBEDDED_ACTIVITIES: bit(1) << bit(39),
  MODERATE_MEMBERS: bit(1) << bit(40)
};
/**
 * Bitfield representing every permission combined
 * @type {number}
 */
Permissions.ALL = Object.keys(Permissions.FLAGS).reduce((all, p) => all | Permissions.FLAGS[p], bit(0));

/**
 * Bitfield representing the default permissions for users
 * @type {number}
 */
Permissions.DEFAULT = BigInt(104324673);

Permissions.defaultBit = BigInt(0);
/**
 * @class EvaluatedPermissions
 * @classdesc The final evaluated permissions for a member in a channel
 * @see {@link Permissions}
 * @deprecated
 */

Permissions.prototype.hasPermission = util.deprecate(Permissions.prototype.hasPermission,
  'EvaluatedPermissions#hasPermission is deprecated, use Permissions#has instead');
Permissions.prototype.hasPermissions = util.deprecate(Permissions.prototype.hasPermissions,
  'EvaluatedPermissions#hasPermissions is deprecated, use Permissions#has instead');
Permissions.prototype.missingPermissions = util.deprecate(Permissions.prototype.missingPermissions,
  'EvaluatedPermissions#missingPermissions is deprecated, use Permissions#missing instead');
Object.defineProperty(Permissions.prototype, 'raw', {
  get: util
    .deprecate(Object.getOwnPropertyDescriptor(Permissions.prototype, 'raw').get,
      'EvaluatedPermissions#raw is deprecated use Permissions#bitfield instead'),
  set: util.deprecate(Object.getOwnPropertyDescriptor(Permissions.prototype, 'raw').set,
    'EvaluatedPermissions#raw is deprecated use Permissions#bitfield instead'),
});
Object.defineProperty(Permissions.prototype, 'member', {
  get: util
    .deprecate(Object.getOwnPropertyDescriptor(Permissions.prototype, 'member').get,
      'EvaluatedPermissions#member is deprecated'),
  set: util
    .deprecate(Object.getOwnPropertyDescriptor(Permissions.prototype, 'member').set,
      'EvaluatedPermissions#member is deprecated'),
});

module.exports = Permissions;
