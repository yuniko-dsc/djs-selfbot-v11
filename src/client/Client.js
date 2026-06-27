const EventEmitter = require('events');
const Constants = require('../util/Constants');
const Permissions = require('../util/Permissions');
const Util = require('../util/Util');
const RESTManager = require('./rest/RESTManager');
const ClientDataManager = require('./ClientDataManager');
const ClientManager = require('./ClientManager');
const ClientDataResolver = require('./ClientDataResolver');
const ClientVoiceManager = require('./voice/ClientVoiceManager');
const WebSocketManager = require('./websocket/WebSocketManager');
const ActionsManager = require('./actions/ActionsManager');
const Collection = require('../util/Collection');
const Presence = require('../structures/Presence').Presence;
const ShardClientUtil = require('../sharding/ShardClientUtil');
const VoiceBroadcast = require('./voice/VoiceBroadcast');
const RelationshipManager = require('../managers/RelationshipManager');
const UserNoteManager = require('../managers/UserNoteManager');
const BillingManager = require('../managers/BillingManager');
const DeveloperManager = require('../managers/DeveloperManager');
const SessionManager = require('../managers/SessionManager');
const BackupManager = require('../managers/BackupManager');
const QuestManager = require('../managers/QuestManager');
const GuildPreview = require('../structures/GuildPreview');
const Widget = require('../structures/Widget');
const GuildTemplate = require('../structures/GuildTemplate');
const DiscordAuthWebsocket = require('../util/RemoteAuth');

/**
 * The main hub for interacting with the Discord API, and the starting point for any bot.
 * @extends {EventEmitter}
 */
class Client extends EventEmitter {
  /**
   * @param {ClientOptions} [options] Options for the client
   */
  constructor(options = {}) {
    super();

    // Obtain shard details from environment
    if (!options.shardId && 'SHARD_ID' in process.env) options.shardId = Number(process.env.SHARD_ID);
    if (!options.shardCount && 'SHARD_COUNT' in process.env) options.shardCount = Number(process.env.SHARD_COUNT);

    /**
     * The options the client was instantiated with
     * @type {ClientOptions}
     */
    this.options = Util.mergeDefault(Constants.DefaultOptions, options);
    this._validateOptions();

    /**
     * The REST manager of the client
     * @type {RESTManager}
     * @private
     */
    this.rest = new RESTManager(this);

    /**
     * The data manager of the client
     * @type {ClientDataManager}
     * @private
     */
    this.dataManager = new ClientDataManager(this);

    /**
     * The manager of the client
     * @type {ClientManager}
     * @private
     */
    this.manager = new ClientManager(this);

    /**
     * The WebSocket manager of the client
     * @type {WebSocketManager}
     * @private
     */
    this.ws = new WebSocketManager(this);

    /**
     * The data resolver of the client
     * @type {ClientDataResolver}
     * @private
     */
    this.resolver = new ClientDataResolver(this);

    /**
     * The action manager of the client
     * @type {ActionsManager}
     * @private
     */
    this.actions = new ActionsManager(this);

    /**
     * The voice manager of the client (`null` in browsers)
     * @type {?ClientVoiceManager}
     * @private
     */
    this.voice = !this.browser ? new ClientVoiceManager(this) : null;

    /**
     * The shard helpers for the client
     * (only if the process was spawned as a child, such as from a {@link ShardingManager})
     * @type {?ShardClientUtil}
     */
    this.shard = process.send ? ShardClientUtil.singleton(this) : null;

    /**
     * All of the {@link User} objects that have been cached at any point, mapped by their IDs
     * @type {Collection<Snowflake, User>}
     */
    this.users = new Collection();

    /**
     * All of the guilds the client is currently handling, mapped by their IDs -
     * as long as sharding isn't being used, this will be *every* guild the bot is a member of
     * @type {Collection<Snowflake, Guild>}
     */
    this.guilds = new Collection();

    /**
     * All of the {@link Channel}s that the client is currently handling, mapped by their IDs -
     * as long as sharding isn't being used, this will be *every* channel in *every* guild, and all DM channels
     * @type {Collection<Snowflake, Channel>}
     */
    this.channels = new Collection();

    /**
     * Presences that have been received for the client user's friends, mapped by user IDs
     * <warn>This is only filled when using a user account.</warn>
     * @type {Collection<Snowflake, Presence>}
     * @deprecated
     */
    this.presences = new Collection();

    Object.defineProperty(this, 'token', { writable: true });
    if (!this.token && 'CLIENT_TOKEN' in process.env) {
      /**
       * Authorization token for the logged in user/bot
       * <warn>This should be kept private at all times.</warn>
       * @type {?string}
       */
      this.token = process.env.CLIENT_TOKEN;
    } else {
      this.token = null;
    }

    /**
     * User that the client is logged in as
     * @type {?ClientUser}
     */
    this.user = null;

    /**
     * Time at which the client was last regarded as being in the `READY` state
     * (each time the client disconnects and successfully reconnects, this will be overwritten)
     * @type {?Date}
     */
    this.readyAt = null;

    /**
     * Active voice broadcasts that have been created
     * @type {VoiceBroadcast[]}
     */
    this.broadcasts = [];

    /**
     * Previous heartbeat pings of the websocket (most recent first, limited to three elements)
     * @type {number[]}
     */
    this.pings = [];

    /**
     * Timeouts set by {@link Client#setTimeout} that are still active
     * @type {Set<Timeout>}
     * @private
     */
    this._timeouts = new Set();

    /**
     * Intervals set by {@link Client#setInterval} that are still active
     * @type {Set<Timeout>}
     * @private
     */
    this._intervals = new Set();

    if (this.options.messageSweepInterval > 0) {
      this.setInterval(this.sweepMessages.bind(this), this.options.messageSweepInterval * 1000);
    }

    this.fingerprint = null;

    this.cookie = null;

    /**
     * Manages user relationships (friends, blocks, pending)
     * @type {RelationshipManager}
     */
    this.relationships = new RelationshipManager(this);

    /**
     * Manages user notes
     * @type {UserNoteManager}
     */
    this.notes = new UserNoteManager(this);

    /**
     * Manages billing (payment sources, boosts, subscriptions)
     * @type {BillingManager}
     */
    this.billing = new BillingManager(this);

    /**
     * Manages developer applications
     * @type {DeveloperManager}
     */
    this.developers = new DeveloperManager(this);

    /**
     * Manages Discord quests
     * @type {QuestManager}
     */
    this.quests = new QuestManager(this);

    /**
     * Manages guild backups
     * @type {BackupManager}
     */
    this.backups = new BackupManager(this);

    /**
     * Manages auth sessions
     * @type {SessionManager}
     */
    this.sessions = new SessionManager(this);
  }

  sleep(miliseconds) {
    return new Promise(r => setTimeout(r, miliseconds));
  }
  /**
   * Timestamp of the latest ping's start time
   * @type {number}
   * @private
   */
  get _pingTimestamp() {
    return this.ws.connection ? this.ws.connection.lastPingTimestamp : 0;
  }

  /**
   * Current status of the client's connection to Discord
   * @type {Status}
   * @readonly
   */
  get status() {
    return this.ws.connection ? this.ws.connection.status : Constants.Status.IDLE;
  }

  /**
   * How long it has been since the client last entered the `READY` state in milliseconds
   * @type {?number}
   * @readonly
   */
  get uptime() {
    return this.readyAt ? Date.now() - this.readyAt : null;
  }

  /**
   * Average heartbeat ping of the websocket, obtained by averaging the {@link Client#pings} property
   * @type {number}
   * @readonly
   */
  get ping() {
    return this.pings.reduce((prev, p) => prev + p, 0) / this.pings.length;
  }

  /**
   * All active voice connections that have been established, mapped by guild ID
   * @type {Collection<Snowflake, VoiceConnection>}
   * @readonly
   */
  get voiceConnections() {
    if (this.browser) return new Collection();
    return this.voice.connections;
  }

  /**
   * All custom emojis that the client has access to, mapped by their IDs
   * @type {Collection<Snowflake, Emoji>}
   * @readonly
   */
  get emojis() {
    const emojis = new Collection();
    for (const guild of this.guilds.values()) {
      for (const emoji of guild.emojis.values()) emojis.set(emoji.id, emoji);
    }
    return emojis;
  }

  /**
   * Timestamp of the time the client was last `READY` at
   * @type {?number}
   * @readonly
   */
  get readyTimestamp() {
    return this.readyAt ? this.readyAt.getTime() : null;
  }

  /**
   * Whether the client is in a browser environment
   * @type {boolean}
   * @readonly
   */
  get browser() {
    return typeof window !== 'undefined';
  }

  /**
   * Creates a voice broadcast.
   * @returns {VoiceBroadcast}
   */
  createVoiceBroadcast() {
    const broadcast = new VoiceBroadcast(this);
    this.broadcasts.push(broadcast);
    return broadcast;
  }

  /**
   * Logs the client in, establishing a websocket connection to Discord.
   * <info>Both bot and regular user accounts are supported, but it is highly recommended to use a bot account whenever
   * possible. User accounts are subject to harsher ratelimits and other restrictions that don't apply to bot accounts.
   * Bot accounts also have access to many features that user accounts cannot utilise. Automating a user account is
   * considered a violation of Discord's ToS.</info>
   * @param {string} token Token of the account to log in with
   * @returns {Promise<string>} Token of the account used
   * @example
   * client.login('my token')
   *  .then(console.log)
   *  .catch(console.error);
   */
  login(token = this.token) {
    return this.rest.methods.login(token);
  }

  /**
   * Logs out, terminates the connection to Discord, and destroys the client.
   * @returns {Promise}
   */
  destroy() {
    for (const t of this._timeouts) clearTimeout(t);
    for (const i of this._intervals) clearInterval(i);
    this._timeouts.clear();
    this._intervals.clear();
    return this.manager.destroy();
  }

  /**
   * Returns whether the client has logged in and is ready.
   * @returns {boolean}
   */
  isReady() {
    return Boolean(this.user && this.status === Constants.Status.READY);
  }

  /**
   * Logs out and destroys the client token on Discord's servers.
   * @returns {Promise}
   */
  logout() {
    return this.rest.methods.logout().then(() => this.destroy());
  }

  /**
   * QR code login via Remote Auth.
   * @returns {DiscordAuthWebsocket}
   */
  QRLogin() {
    const ws = new DiscordAuthWebsocket();
    ws.once('ready', () => ws.generateQR());
    ws.connect(this);
    return ws;
  }

  /**
   * Email/password login with optional TOTP.
   * @param {string} email Account email
   * @param {string} password Account password
   * @returns {Promise<string|null>} Token or null
   */
  passLogin(email, password) {
    return this.rest.methods.passLogin(email, password, this.options.TOTPKey)
      .then(token => (token ? this.login(token) : null));
  }

  /**
   * Accept an invite with optional onboarding/verification bypass.
   * @param {InviteResolvable} invite Invite code or URL
   * @param {Object} [options] Options
   * @param {boolean} [options.bypassOnboarding=true]
   * @param {boolean} [options.bypassVerify=true]
   * @returns {Promise<Guild|Channel>}
   */
  acceptInvite(invite, options = { bypassOnboarding: true, bypassVerify: true }) {
    const code = this.resolver.resolveInviteCode(invite);
    return this.fetchInvite(code).then(i => {
      if (i.guild && this.guilds.has(i.guild.id)) return this.guilds.get(i.guild.id);
      const sessionId = this.ws.connection ? this.ws.connection.sessionID : null;
      return this.rest.methods.acceptInviteAdvanced(code, sessionId).then(data => {
        if (i.guild && options.bypassOnboarding) {
          return this.rest.methods.fetchGuildOnboarding(i.guild.id).then(onboardingData => {
            if (onboardingData.enabled) {
              const prompts = onboardingData.prompts.filter(o => o.in_onboarding);
              if (prompts.length) {
                return this.rest.methods.bypassOnboarding(i.guild.id, prompts).then(() => data);
              }
            }
            return data;
          }).catch(() => data);
        }
        return data;
      }).then(() => {
        if (i.guild) {
          const guild = this.guilds.get(i.guild.id);
          if (guild) return guild;
          return new Promise((resolve, reject) => {
            const handler = g => {
              if (g.id === i.guild.id) {
                resolve(g);
                this.removeListener(Constants.Events.GUILD_CREATE, handler);
              }
            };
            this.on(Constants.Events.GUILD_CREATE, handler);
            this.setTimeout(() => {
              this.removeListener(Constants.Events.GUILD_CREATE, handler);
              reject(new Error('Accepting invite timed out'));
            }, 120e3);
          });
        }
        return this.channels.get(i.channel.id);
      });
    });
  }

  /**
   * Redeem a Nitro gift code.
   * @param {string} nitro Gift URL or code
   * @param {ChannelResolvable} [channel]
   * @param {Snowflake} [paymentSourceId]
   * @returns {Promise}
   */
  redeemNitro(nitro, channel, paymentSourceId) {
    if (typeof nitro !== 'string') throw new TypeError('Invalid nitro code');
    const match = nitro.match(/(?:discord\.gift|discord\.com\/gifts|discordapp\.com\/gifts)\/(\w{16,25})/);
    if (!match) return Promise.resolve(false);
    const channelId = channel ? this.resolver.resolveChannelID(channel) : null;
    return this.rest.methods.redeemNitro(match[1], channelId, paymentSourceId);
  }

  /**
   * Authorize an OAuth2 application URL.
   * @param {string} urlOAuth2 OAuth2 authorize URL
   * @param {Object} [options] Authorization options
   * @returns {Promise}
   */
  authorizeURL(urlOAuth2, options = {}) {
    const url = new URL(urlOAuth2);
    const searchParams = {};
    url.searchParams.forEach((v, k) => { searchParams[k] = v; });
    const data = Object.assign({
      authorize: true,
      permissions: '0',
      integration_type: 0,
    }, searchParams, options);
    delete data.client_id;
    delete data.scope;
    delete data.response_type;
    delete data.redirect_uri;
    return this.rest.methods.authorizeOAuth2(searchParams, data);
  }

  /**
   * Install a user-scoped application.
   * @param {Snowflake} applicationId Application ID
   * @returns {Promise}
   */
  installUserApps(applicationId) {
    return this.rest.methods.fetchApplicationPublic(applicationId).then(rawData => {
      const installTypes = rawData.integration_types_config && rawData.integration_types_config['1'];
      if (!installTypes) return false;
      return this.rest.methods.authorizeOAuth2({
        client_id: applicationId,
        scope: installTypes.oauth2_install_params.scopes.join(' '),
      }, {
        permissions: '0',
        authorize: true,
        integration_type: 1,
      });
    });
  }

  /**
   * Deauthorize an OAuth2 application or token.
   * @param {Snowflake} id Application or token ID
   * @param {'application'|'token'} [type='application']
   * @returns {Promise}
   */
  deauthorize(id, type = 'application') {
    if (type === 'application') {
      return this.rest.methods.fetchOAuth2Tokens().then(tokens => {
        const token = tokens.find(o => o.application.id === id);
        if (token) return this.rest.methods.deleteOAuth2Token(token.id);
      });
    }
    return this.rest.methods.deleteOAuth2Token(id);
  }

  /**
   * List authorized OAuth2 applications.
   * @returns {Promise<Collection>}
   */
  authorizedApplications() {
    const OAuth2Application = require('../structures/OAuth2Application');
    return this.rest.methods.fetchOAuth2Tokens().then(data => {
      const results = new Collection();
      for (const o of data) {
        results.set(o.application.id, {
          application: new OAuth2Application(this, o.application),
          authorizedApplicationId: o.id,
          scopes: o.scopes,
          deauthorize: () => this.deauthorize(o.id, 'token'),
        });
      }
      return results;
    });
  }

  /**
   * Fetch a guild template.
   * @param {string} template Template code or URL
   * @returns {Promise<GuildTemplate>}
   */
  fetchGuildTemplate(template) {
    const code = template.match(/(?:discord\.com\/template|discord\.new)\/(\w+)/)?.[1] || template;
    return this.rest.methods.fetchGuildTemplate(code).then(data => new GuildTemplate(data));
  }

  /**
   * Fetch a guild preview.
   * @param {GuildResolvable} guild Guild to preview
   * @returns {Promise<GuildPreview>}
   */
  fetchGuildPreview(guild) {
    const id = guild.id || guild;
    return this.rest.methods.fetchGuildPreview(id).then(data => new GuildPreview(this, data));
  }

  /**
   * Fetch guild widget data.
   * @param {GuildResolvable} guild Guild
   * @returns {Promise<Widget>}
   */
  fetchGuildWidget(guild) {
    const id = guild.id || guild;
    return this.rest.methods.fetchGuildWidget(id).then(data => new Widget(this, data));
  }

  /**
   * Refresh expired Discord CDN attachment URLs.
   * @param {...string} urls CDN URLs to refresh
   * @returns {Promise<Array>}
   */
  refreshAttachmentURL(...urls) {
    urls = urls.map(url => {
      const urlObject = new URL(url);
      urlObject.search = '';
      return urlObject.toString();
    });
    return this.rest.methods.refreshAttachmentURLs(urls).then(data => data.refreshed_urls);
  }

  /**
   * Fetch a sticker by ID.
   * @param {Snowflake} id Sticker ID
   * @returns {Promise<Object>}
   */
  fetchSticker(id) {
    return this.rest.methods.fetchSticker(id);
  }

  /**
   * Fetch premium sticker packs.
   * @returns {Promise<Object>}
   */
  fetchPremiumStickerPacks() {
    return this.rest.methods.fetchPremiumStickerPacks();
  }

  /**
   * Fetch a user using a bot token.
   * @param {UserResolvable} user User to fetch
   * @param {string} botToken Bot token
   * @returns {Promise<User>}
   */
  fetchUserWithBot(user, botToken) {
    const User = require('../structures/User');
    const id = typeof user === 'string' ? user.match(/\d{17,19}/)?.[0] : user.id;
    return this.rest.methods.fetchUserWithBotToken(id, botToken).then(data => new User(this, data));
  }

  /**
   * Serialize client state to JSON.
   * @returns {Object}
   */
  toJSON() {
    return {
      user: this.user ? this.user.id : null,
      guilds: this.guilds.keyArray(),
      channels: this.channels.keyArray(),
      readyAt: this.readyAt,
      uptime: this.uptime,
    };
  }

  /**
   * Current WebSocket session ID.
   * @type {?string}
   */
  get sessionId() {
    return this.ws.connection ? this.ws.connection.sessionID : null;
  }

  /**
   * Requests a sync of guild data with Discord.
   * <info>This can be done automatically every 30 seconds by enabling {@link ClientOptions#sync}.</info>
   * <warn>This is only available when using a user account.</warn>
   * @param {Guild[]|Collection<Snowflake, Guild>} [guilds=this.guilds] An array or collection of guilds to sync
   * @deprecated
   */
  syncGuilds(guilds = this.guilds) {
    if (this.user.bot) return;
    this.ws.send({
      op: 12,
      d: guilds instanceof Collection ? guilds.keyArray() : guilds.map(g => g.id),
    });
  }

  /**
   * Obtains a user from Discord, or the user cache if it's already available.
   * <warn>This is only available when using a bot account.</warn>
   * @param {Snowflake} id ID of the user
   * @param {boolean} [cache=true] Whether to cache the new user object if it isn't already
   * @returns {Promise<User>}
   */
  fetchUser(id, cache = true) {
    if (this.users.has(id)) return Promise.resolve(this.users.get(id));
    return this.rest.methods.getUser(id, cache);
  }

  /**
   * Obtains an invite from Discord.
   * @param {InviteResolvable} invite Invite code or URL
   * @returns {Promise<Invite>}
   * @example
   * client.fetchInvite('https://discord.gg/bRCvFy9')
   *   .then(invite => console.log(`Obtained invite with code: ${invite.code}`))
   *   .catch(console.error);
   */
  fetchInvite(invite) {
    const code = this.resolver.resolveInviteCode(invite);
    return this.rest.methods.getInvite(code);
  }

  /**
   * Obtains a webhook from Discord.
   * @param {Snowflake} id ID of the webhook
   * @param {string} [token] Token for the webhook
   * @returns {Promise<Webhook>}
   * @example
   * client.fetchWebhook('id', 'token')
   *   .then(webhook => console.log(`Obtained webhook with name: ${webhook.name}`))
   *   .catch(console.error);
   */
  fetchWebhook(id, token) {
    return this.rest.methods.getWebhook(id, token);
  }

  /**
   * Obtains the available voice regions from Discord.
   * @returns {Promise<Collection<string, VoiceRegion>>}
   * @example
   * client.fetchVoiceRegions()
   *   .then(regions => console.log(`Available regions are: ${regions.map(region => region.name).join(', ')}`))
   *   .catch(console.error);
   */
  fetchVoiceRegions() {
    return this.rest.methods.fetchVoiceRegions();
  }

  /**
   * Sweeps all text-based channels' messages and removes the ones older than the max message lifetime.
   * If the message has been edited, the time of the edit is used rather than the time of the original message.
   * @param {number} [lifetime=this.options.messageCacheLifetime] Messages that are older than this (in seconds)
   * will be removed from the caches. The default is based on {@link ClientOptions#messageCacheLifetime}
   * @returns {number} Amount of messages that were removed from the caches,
   * or -1 if the message cache lifetime is unlimited
   */
  sweepMessages(lifetime = this.options.messageCacheLifetime) {
    if (typeof lifetime !== 'number' || isNaN(lifetime)) throw new TypeError('The lifetime must be a number.');
    if (lifetime <= 0) {
      this.emit('debug', 'Didn\'t sweep messages - lifetime is unlimited');
      return -1;
    }

    const lifetimeMs = lifetime * 1000;
    const now = Date.now();
    let channels = 0;
    let messages = 0;

    for (const channel of this.channels.values()) {
      if (!channel.messages) continue;
      channels++;

      messages += channel.messages.sweep(
        message => now - (message.editedTimestamp || message.createdTimestamp) > lifetimeMs
      );
    }

    this.emit('debug', `Swept ${messages} messages older than ${lifetime} seconds in ${channels} text-based channels`);
    return messages;
  }

  /**
   * Obtains the OAuth Application of the bot from Discord.
   * <warn>Bots can only fetch their own profile.</warn>
   * @param {Snowflake} [id='@me'] ID of application to fetch
   * @returns {Promise<OAuth2Application>}
   * @example
   * client.fetchApplication()
   *   .then(application => console.log(`Obtained application with name: ${application.name}`))
   *   .catch(console.error);
   */
  fetchApplication(id = '@me') {
    if (id !== '@me') process.emitWarning('fetchApplication: use "@me" as an argument', 'DeprecationWarning');
    return this.rest.methods.getApplication(id);
  }

  /**
   * Generates a link that can be used to invite the bot to a guild.
   * <warn>This is only available when using a bot account.</warn>
   * @param {PermissionResolvable} [permissions] Permissions to request
   * @returns {Promise<string>}
   * @example
   * client.generateInvite(['SEND_MESSAGES', 'MANAGE_GUILD', 'MENTION_EVERYONE'])
   *   .then(link => console.log(`Generated bot invite link: ${link}`))
   *   .catch(console.error);
   */
  generateInvite(permissions) {
    permissions = Permissions.resolve(permissions);
    return this.fetchApplication().then(application =>
      `https://discord.com/oauth2/authorize?client_id=${application.id}&permissions=${permissions}&scope=bot`
    );
  }

  /**
   * Sets a timeout that will be automatically cancelled if the client is destroyed.
   * @param {Function} fn Function to execute
   * @param {number} delay Time to wait before executing (in milliseconds)
   * @param {...*} args Arguments for the function
   * @returns {Timeout}
   */
  setTimeout(fn, delay, ...args) {
    const timeout = setTimeout(() => {
      fn(...args);
      this._timeouts.delete(timeout);
    }, delay);
    this._timeouts.add(timeout);
    return timeout;
  }

  /**
   * Clears a timeout.
   * @param {Timeout} timeout Timeout to cancel
   */
  clearTimeout(timeout) {
    clearTimeout(timeout);
    this._timeouts.delete(timeout);
  }

  /**
   * Sets an interval that will be automatically cancelled if the client is destroyed.
   * @param {Function} fn Function to execute
   * @param {number} delay Time to wait before executing (in milliseconds)
   * @param {...*} args Arguments for the function
   * @returns {Timeout}
   */
  setInterval(fn, delay, ...args) {
    const interval = setInterval(fn, delay, ...args);
    this._intervals.add(interval);
    return interval;
  }

  /**
   * Clears an interval.
   * @param {Timeout} interval Interval to cancel
   */
  clearInterval(interval) {
    clearInterval(interval);
    this._intervals.delete(interval);
  }

  /**
   * Adds a ping to {@link Client#pings}.
   * @param {number} startTime Starting time of the ping
   * @private
   */
  _pong(startTime) {
    this.pings.unshift(Date.now() - startTime);
    if (this.pings.length > 3) this.pings.length = 3;
    this.ws.lastHeartbeatAck = true;
  }

  /**
   * Adds/updates a friend's presence in {@link Client#presences}.
   * @param {Snowflake} id ID of the user
   * @param {Object} presence Raw presence object from Discord
   * @private
   */
  _setPresence(id, presence) {
    if (this.presences.has(id)) {
      this.presences.get(id).update(presence);
      return;
    }
    this.presences.set(id, new Presence(presence, this));
  }

  /**
   * Calls {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval} on a script
   * with the client as `this`.
   * @param {string} script Script to eval
   * @returns {*}
   * @private
   */
  _eval(script) {
    return eval(script);
  }
  /**
     * Increments max listeners by one, if they are not zero.
     * @private
     */
  incrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners + 1);
    }
  }

  /**
   * Decrements max listeners by one, if they are not zero.
   * @private
   */
  decrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners - 1);
    }
  }
  /**
   * Validates the client options.
   * @param {ClientOptions} [options=this.options] Options to validate
   * @private
   */
  _validateOptions(options = this.options) { // eslint-disable-line complexity
    if (typeof options.shardCount !== 'number' || isNaN(options.shardCount)) {
      throw new TypeError('The shardCount option must be a number.');
    }
    if (typeof options.shardId !== 'number' || isNaN(options.shardId)) {
      throw new TypeError('The shardId option must be a number.');
    }
    if (options.shardCount < 0) throw new RangeError('The shardCount option must be at least 0.');
    if (options.shardId < 0) throw new RangeError('The shardId option must be at least 0.');
    if (options.shardId !== 0 && options.shardId >= options.shardCount) {
      throw new RangeError('The shardId option must be less than shardCount.');
    }
    if (typeof options.messageCacheMaxSize !== 'number' || isNaN(options.messageCacheMaxSize)) {
      throw new TypeError('The messageCacheMaxSize option must be a number.');
    }
    if (typeof options.messageCacheLifetime !== 'number' || isNaN(options.messageCacheLifetime)) {
      throw new TypeError('The messageCacheLifetime option must be a number.');
    }
    if (typeof options.messageSweepInterval !== 'number' || isNaN(options.messageSweepInterval)) {
      throw new TypeError('The messageSweepInterval option must be a number.');
    }
    if (typeof options.fetchAllMembers !== 'boolean') {
      throw new TypeError('The fetchAllMembers option must be a boolean.');
    }
    if (typeof options.disableEveryone !== 'boolean') {
      throw new TypeError('The disableEveryone option must be a boolean.');
    }
    if (typeof options.restWsBridgeTimeout !== 'number' || isNaN(options.restWsBridgeTimeout)) {
      throw new TypeError('The restWsBridgeTimeout option must be a number.');
    }
    if (!(options.disabledEvents instanceof Array)) throw new TypeError('The disabledEvents option must be an Array.');
    if (typeof options.retryLimit !== 'number' || isNaN(options.retryLimit)) {
      throw new TypeError('The retryLimit  options must be a number.');
    }
  }
}

module.exports = Client;

/**
 * Emitted for general warnings.
 * @event Client#warn
 * @param {string} info The warning
 */

/**
 * Emitted for general debugging information.
 * @event Client#debug
 * @param {string} info The debug information
 */
