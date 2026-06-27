const path = require('path');
const Message = require('../Message');
const MessageCollector = require('../MessageCollector');
const Collection = require('../../util/Collection');
const Attachment = require('../../structures/Attachment');
const RichEmbed = require('../../structures/RichEmbed');
const Snowflake = require('../../util/Snowflake');
const util = require('util');

/**
 * Interface for classes that have text-channel-like features.
 * @interface
 */
class TextBasedChannel {
  constructor() {
    /**
     * A collection containing the messages sent to this channel
     * @type {Collection<Snowflake, Message>}
     */
    this.messages = new Collection();

    /**
     * The ID of the last message in the channel, if one was sent
     * @type {?Snowflake}
     */
    this.lastMessageID = null;

    /**
     * The Message object of the last message in the channel, if one was sent
     * @type {?Message}
     */
    this.lastMessage = null;

    /**
     * The timestamp when the last pinned message was pinned, if there was one
     * @type {?number}
     */
    this.lastPinTimestamp = null;
  }

  /**
   * Options provided when sending or editing a message.
   * @typedef {Object} MessageOptions
   * @property {boolean} [tts=false] Whether or not the message should be spoken aloud
   * @property {string} [nonce=''] The nonce for the message
   * @property {RichEmbed|Object} [embed] An embed for the message
   * (see [here](https://discordapp.com/developers/docs/resources/channel#embed-object) for more details)
   * @property {boolean} [disableEveryone=this.client.options.disableEveryone] Whether or not @everyone and @here
   * should be replaced with plain-text
   * @property {FileOptions|BufferResolvable|Attachment} [file] A file to send with the message **(deprecated)**
   * @property {FileOptions[]|BufferResolvable[]|Attachment[]} [files] Files to send with the message
   * @property {string|boolean} [code] Language for optional codeblock formatting to apply
   * @property {boolean|SplitOptions} [split=false] Whether or not the message should be split into multiple messages if
   * it exceeds the character limit. If an object is provided, these are the options for splitting the message
   * @property {UserResolvable} [reply] User to reply to (prefixes the message with a mention, except in DMs)
   */

  /**
   * @typedef {Object} FileOptions
   * @property {BufferResolvable} attachment File to attach
   * @property {string} [name='file.jpg'] Filename of the attachment
   */

  /**
   * @typedef {Object} SplitOptions
   * @property {number} [maxLength=1950] Maximum character length per message piece
   * @property {string} [char='\n'] Character to split the message with
   * @property {string} [prepend=''] Text to prepend to every piece except the first
   * @property {string} [append=''] Text to append to every piece except the last
   */

  send(content, options) {
    if (!options && typeof content === 'object' && !(content instanceof Array)) {
      options = content;
      content = '';
    } else if (!options) {
      options = {};
    }

    const { reply } = options;
    if (options instanceof Attachment) options = { files: [options.file] };
    if (options instanceof RichEmbed) {
      if (options.reply) options.reply = undefined;
      options = { embeds: [options] };
    }
    options.reply = reply;

    if (options.embeds) {
      const files = [];
      for (const embed of options.embeds) {
        if (embed.file) files.push(embed.file);
      }
      if (options.files) options.files.push(...files);
      else options.files = files;
    }

    if (options.file) {
      if (options.files) options.files.push(options.file);
      else options.files = [options.file];
    }

    if (options.embeds) options.embeds = options.embeds.map(e => new RichEmbed(e).toJSON());

    if (options.files) {
      for (let i = 0; i < options.files.length; i++) {
        let file = options.files[i];
        if (!file || typeof file === 'string' || Buffer.isBuffer(file)) file = { attachment: file };
        if (!file.name) {
          if (typeof file.attachment === 'string') {
            file.name = path.basename(file.attachment);
          } else if (file.attachment && file.attachment.path) {
            file.name = path.basename(file.attachment.path);
          } else if (file instanceof Attachment) {
            file = { attachment: file.file, name: path.basename(file.file) || 'file.jpg' };
          } else {
            file.name = 'file.jpg';
          }
        } else if (file instanceof Attachment) {
          file = file.file;
        }
        options.files[i] = file;
      }

      return Promise.all(options.files.map(file =>
        this.client.resolver.resolveFile(file.attachment).then(resource => {
          file.file = resource;
          return file;
        })
      )).then(files => this.client.rest.methods.sendMessage(this, content, options, files));
    }

    return this.client.rest.methods.sendMessage(this, content, options);
  }

  fetchMessage(messageID) {
    if (!this.client.user.bot) {
      return this.fetchMessages({ limit: 1, around: messageID }).then(messages => {
        const msg = messages.get(messageID);
        if (!msg) throw new Error('Message not found.');
        return msg;
      });
    }
    return this.client.rest.methods.getChannelMessage(this, messageID).then(data => {
      const msg = data instanceof Message ? data : new Message(this, data, this.client);
      this._cacheMessage(msg);
      return msg;
    });
  }

  fetchMessages(options = {}) {
    return this.client.rest.methods.getChannelMessages(this, options).then(data => {
      const messages = new Collection();
      for (const message of data) {
        const msg = new Message(this, message, this.client);
        messages.set(message.id, msg);
        this._cacheMessage(msg);
      }
      return messages;
    });
  }

  fetchPinnedMessages() {
    return this.client.rest.methods.getChannelPinnedMessages(this).then(data => {
      const messages = new Collection();
      for (const message of data) {
        const msg = new Message(this, message, this.client);
        messages.set(message.id, msg);
        this._cacheMessage(msg);
      }
      return messages;
    });
  }

  search(options = {}) {
    return this.client.rest.methods.search(this, options);
  }

  /**
   * Starts a typing indicator in the channel.
   * @param {number} [count=1] The number of times startTyping should be considered to have been called
   * @example
   * // Start typing in a channel
   * channel.startTyping();
   */
  startTyping(count) {
    if (typeof count !== 'undefined' && count < 1) throw new RangeError('Count must be at least 1.');
    if (this.client.user._typing.has(this.id)) {
      const entry = this.client.user._typing.get(this.id);
      entry.count = count || entry.count + 1;
      return;
    }

    const entry = {
      count: count || 1,
      interval: this.client.setInterval(() => {
        this.client.rest.methods.sendTyping(this.id).catch(() => {
          this.client.clearInterval(entry.interval);
          this.client.user._typing.delete(this.id);
        });
      }, 9000),
    };
    this.client.rest.methods.sendTyping(this.id).catch(() => {
      this.client.clearInterval(entry.interval);
      this.client.user._typing.delete(this.id);
    });
    this.client.user._typing.set(this.id, entry);
  }

  /**
   * Stops the typing indicator in the channel.
   * The indicator will only stop if this is called as many times as startTyping().
   * <info>It can take up to 10 seconds for Discord to stop showing the typing indicator after the last typing request.</info>
   * @param {boolean} [force=false] Whether or not to reset the call count and force the indicator to stop
   * @example
   * // Reduce the typing count by one and stop typing if it reached 0
   * channel.stopTyping();
   * @example
   * // Force typing to fully stop in a channel
   * channel.stopTyping(true);
   */
  stopTyping(force = false) {
    if (!this.client.user._typing.has(this.id)) return;
    
    const entry = this.client.user._typing.get(this.id);
    
    if (force) {
      // Force stop: clear interval and remove entry immediately
      if (entry.interval) {
        this.client.clearInterval(entry.interval);
      }
      this.client.user._typing.delete(this.id);
    } else {
      // Normal stop: decrement count
      entry.count--;
      if (entry.count <= 0) {
        if (entry.interval) {
          this.client.clearInterval(entry.interval);
        }
        this.client.user._typing.delete(this.id);
      }
    }
  }

  get typing() {
    return this.client.user._typing.has(this.id);
  }

  get typingCount() {
    if (this.client.user._typing.has(this.id)) return this.client.user._typing.get(this.id).count;
    return 0;
  }

  get lastMessage() {
    return this.messages.get(this.lastMessageID) || null;
  }

  get lastPinAt() {
    return this.lastPinTimestamp ? new Date(this.lastPinTimestamp) : null;
  }

  createCollector(filter, options) {
    return this.createMessageCollector(filter, options);
  }

  createMessageCollector(filter, options = {}) {
    return new MessageCollector(this, filter, options);
  }

  awaitMessages(filter, options = {}) {
    return new Promise((resolve, reject) => {
      const collector = this.createCollector(filter, options);
      collector.once('end', (collection, reason) => {
        if (options.errors && options.errors.includes(reason)) {
          reject(collection);
        } else {
          resolve(collection);
        }
      });
    });
  }

  bulkDelete(messages, filterOld = false) {
    if (messages instanceof Array || messages instanceof Collection) {
      let messageIDs = messages instanceof Collection ? messages.keyArray() : messages.map(m => m.id || m);
      if (filterOld) {
        messageIDs = messageIDs.filter(id => Date.now() - Snowflake.deconstruct(id).date.getTime() < 1209600000);
      }
      if (messageIDs.length === 0) return Promise.resolve(new Collection());
      if (messageIDs.length === 1) {
        return this.fetchMessage(messageIDs[0]).then(m => m.delete()).then(m => new Collection([[m.id, m]]));
      }
      return this.client.rest.methods.bulkDeleteMessages(this, messageIDs);
    }
    if (!isNaN(messages)) return this.fetchMessages({ limit: messages }).then(msgs => this.bulkDelete(msgs, filterOld));
    throw new TypeError('The messages must be an Array, Collection, or number.');
  }

  acknowledge() {
    if (!this.lastMessageID) return Promise.resolve(this);
    return this.client.rest.methods.ackTextChannel(this);
  }

  _cacheMessage(message) {
    const maxSize = this.client.options.messageCacheMaxSize;
    if (maxSize === 0) return null;
    if (this.messages.size >= maxSize && maxSize > 0) this.messages.delete(this.messages.firstKey());
    this.messages.set(message.id, message);
    return message;
  }

  /**
   * Search for available slash commands in this channel
   * @returns {Promise<Object>} Object containing applications and application_commands
   */
  searchInteraction() {
    const endpoint = this.guild 
      ? this.client.rest.makeRequest('get', `/guilds/${this.guild.id}/application-command-index`, true)
      : this.client.rest.makeRequest('get', `/channels/${this.id}/application-command-index`, true);
    
    return endpoint.catch(() => ({
      application_commands: [],
      applications: [],
    }));
  }

  /**
   * Send a slash command in this channel
   * @param {string|Snowflake} botOrApplicationId Bot user or application ID
   * @param {string} commandNameString Command name (e.g., "role" or "role add user")
   * @param {...*} args Command arguments
   * @returns {Promise<void>}
   * @example
   * // Send a slash command
   * channel.sendSlash('bot_id', 'ping');
   * @example
   * // Send a slash command with subcommand
   * channel.sendSlash('bot_id', 'role add', user, role);
   */
  async sendSlash(botOrApplicationId, commandNameString, ...args) {
    // Parse command name
    const cmd = commandNameString.trim().split(' ');
    const commandName = cmd[0];
    const sub = cmd.slice(1);

    if (sub.length > 2) {
      throw new Error(`Invalid command name: ${commandNameString}`);
    }

    // Search for commands
    const data = await this.searchInteraction();

    // Find command by name
    const filterCommand = data.application_commands.filter(obj =>
      obj.name === commandName || obj.name_default === commandName
    );

    // Resolve bot/application ID - FIXED: no longer uses resolveID
    botOrApplicationId = (typeof botOrApplicationId === 'object' && botOrApplicationId.id) 
      ? botOrApplicationId.id 
      : botOrApplicationId;
    
    const application = data.applications.find(obj => 
      obj.id === botOrApplicationId || obj.bot_id === botOrApplicationId
    );

    if (!application) {
      throw new Error(`Bot/Application ${botOrApplicationId} not found`);
    }

    // Find command for this application
    const command = filterCommand.find(cmd => cmd.application_id === application.id);
    
    if (!command) {
      throw new Error(`Command ${commandName} not found for application ${application.id}`);
    }

    // Flatten args
    args = args.flat(2);

    let optionFormat = [];
    let optionsMaxdepth, subGroup, subCommand;

    // Handle subcommands
    if (sub.length === 2) {
      // Subcommand Group > Subcommand
      subGroup = command.options.find(obj =>
        obj.type === 2 && (obj.name === sub[0] || obj.name_default === sub[0])
      );
      if (!subGroup) throw new Error(`Subcommand group ${sub[0]} not found`);

      subCommand = subGroup.options.find(obj =>
        obj.type === 1 && (obj.name === sub[1] || obj.name_default === sub[1])
      );
      if (!subCommand) throw new Error(`Subcommand ${sub[1]} not found`);

      optionsMaxdepth = subCommand.options;
    } else if (sub.length === 1) {
      // Subcommand only
      subCommand = command.options.find(obj =>
        obj.type === 1 && (obj.name === sub[0] || obj.name_default === sub[0])
      );
      if (!subCommand) throw new Error(`Subcommand ${sub[0]} not found`);

      optionsMaxdepth = subCommand.options;
    } else {
      optionsMaxdepth = command.options;
    }

    // Build options
    const valueRequired = optionsMaxdepth?.filter(o => o.required).length || 0;
    
    for (let i = 0; i < Math.min(args.length, optionsMaxdepth?.length || 0); i++) {
      const optionInput = optionsMaxdepth[i];
      const value = args[i];

      if (value !== undefined) {
        const data = {
          type: optionInput.type,
          name: optionInput.name,
        };

        // Handle different option types - FIXED: no longer uses resolveID
        switch (optionInput.type) {
          case 5: // BOOLEAN
            data.value = Boolean(value);
            break;
          case 4: // INTEGER
            data.value = Number(value);
            break;
          case 6: // USER
            data.value = (typeof value === 'object' && value.id) ? value.id : value;
            break;
          case 7: // CHANNEL
            data.value = (typeof value === 'object' && value.id) ? value.id : value;
            break;
          case 8: // ROLE
            data.value = value.id || value;
            break;
          case 9: // MENTIONABLE
            data.value = value.id || value;
            break;
          default: // STRING and others
            // Handle choices
            if (optionInput.choices && optionInput.choices.length) {
              const choice = optionInput.choices.find(c => 
                c.name === value || c.value === value
              );
              data.value = choice ? choice.value : value;
            } else {
              data.value = String(value);
            }
        }

        optionFormat.push(data);
      }
    }

    if (valueRequired > optionFormat.length) {
      throw new Error(`Missing required options: ${valueRequired} required, ${optionFormat.length} provided`);
    }

    // Build post data
    let postData;
    if (subGroup) {
      postData = [{
        type: 2, // SUB_COMMAND_GROUP
        name: subGroup.name,
        options: [{
          type: 1, // SUB_COMMAND
          name: subCommand.name,
          options: optionFormat,
        }],
      }];
    } else if (subCommand) {
      postData = [{
        type: 1, // SUB_COMMAND
        name: subCommand.name,
        options: optionFormat,
      }];
    } else {
      postData = optionFormat;
    }

    // Generate nonce
    const nonce = Snowflake.generate();

    // Build interaction payload
    const body = {
      type: 2, // APPLICATION_COMMAND
      application_id: application.id,
      guild_id: this.guild?.id,
      channel_id: this.id,
      session_id: this.client.ws.connection.sessionID,
      data: {
        version: command.version,
        id: command.id,
        name: command.name_default || command.name,
        type: command.type,
        options: postData,
      },
      nonce,
    };

    if (command.guild_id) {
      body.data.guild_id = this.guild?.id;
    }

    // Send interaction
    return this.client.rest.makeRequest('post', '/interactions', true, body);
  }
}


/** @lends TextBasedChannel.prototype */
const Deprecated = {
  sendMessage(content, options) {
    return this.send(content, options);
  },

  sendEmbed(embed, content, options) {
    if (!options && typeof content === 'object' && !(content instanceof Array)) {
      options = content;
      content = '';
    } else if (!options) {
      options = {};
    }
    return this.send(content, Object.assign(options, { embed }));
  },

  sendFiles(files, content, options = {}) {
    return this.send(content, Object.assign(options, { files }));
  },

  sendFile(attachment, name, content, options = {}) {
    return this.send({ files: [{ attachment, name }], content, options });
  },

  sendCode(lang, content, options = {}) {
    return this.send(content, Object.assign(options, { code: lang }));
  },
};

for (const key of Object.keys(Deprecated)) {
  TextBasedChannel.prototype[key] = util.deprecate(Deprecated[key], `TextChannel#${key}: use TextChannel#send instead`);
}

exports.applyToClass = (structure, full = false, ignore = []) => {
  const props = ['send', 'sendMessage', 'sendEmbed', 'sendFile', 'sendFiles', 'sendCode'];
  if (full) {
    props.push(
      '_cacheMessage',
      'acknowledge',
      'fetchMessages',
      'fetchMessage',
      'search',
      'lastMessage',
      'lastPinAt',
      'bulkDelete',
      'startTyping',
      'stopTyping',
      'typing',
      'typingCount',
      'fetchPinnedMessages',
      'createCollector',
      'createMessageCollector',
      'awaitMessages',
      'searchInteraction',
      'sendSlash'
    );
  }
  for (const prop of props) {
    if (ignore.includes(prop)) continue;
    Object.defineProperty(structure.prototype, prop, Object.getOwnPropertyDescriptor(TextBasedChannel.prototype, prop));
  }
};
