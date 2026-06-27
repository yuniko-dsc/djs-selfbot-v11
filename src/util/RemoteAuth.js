'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');
const WebSocket = require('ws');
const snekfetch = require('snekfetch');
const Constants = require('./Constants');

const baseURL = 'https://discord.com/ra/';
const wsURL = 'wss://remote-auth-gateway.discord.gg/?v=2';

const receiveEvent = {
  HELLO: 'hello',
  NONCE_PROOF: 'nonce_proof',
  PENDING_REMOTE_INIT: 'pending_remote_init',
  HEARTBEAT_ACK: 'heartbeat_ack',
  PENDING_TICKET: 'pending_ticket',
  CANCEL: 'cancel',
  PENDING_LOGIN: 'pending_login',
};

const sendEvent = {
  INIT: 'init',
  NONCE_PROOF: 'nonce_proof',
  HEARTBEAT: 'heartbeat',
};

const Event = {
  READY: 'ready',
  ERROR: 'error',
  CANCEL: 'cancel',
  WAIT_SCAN: 'pending',
  FINISH: 'finish',
  CLOSED: 'closed',
  DEBUG: 'debug',
};

/**
 * Discord Remote Auth QR login
 * @extends {EventEmitter}
 */
class DiscordAuthWebsocket extends EventEmitter {
  constructor() {
    super();
    this.token = '';
    this._ws = null;
    this._heartbeatInterval = null;
    this._expire = null;
    this._publicKey = null;
    this._privateKey = null;
    this._ticket = null;
    this._fingerprint = '';
    this._userDecryptString = '';
  }

  get AuthURL() {
    return baseURL + this._fingerprint;
  }

  get exprire() {
    return this._expire;
  }

  get user() {
    return DiscordAuthWebsocket.decryptUser(this._userDecryptString);
  }

  _createWebSocket(url) {
    this._ws = new WebSocket(url, {
      headers: {
        Origin: 'https://discord.com',
        'User-Agent': Constants.UserAgent || 'Mozilla/5.0',
      },
    });
    this._handleWebSocket();
  }

  _handleWebSocket() {
    this._ws.on('error', error => this.emit(Event.ERROR, error));
    this._ws.on('open', () => this.emit(Event.DEBUG, '[WS] Client Connected'));
    this._ws.on('close', () => this.emit(Event.DEBUG, '[WS] Connection closed'));
    this._ws.on('message', this._handleMessage.bind(this));
  }

  _handleMessage(message) {
    message = JSON.parse(message);
    switch (message.op) {
      case receiveEvent.HELLO:
        this._ready(message);
        break;
      case receiveEvent.NONCE_PROOF:
        this._receiveNonceProof(message);
        break;
      case receiveEvent.PENDING_REMOTE_INIT:
        this._fingerprint = message.fingerprint;
        this.emit(Event.READY, this);
        break;
      case receiveEvent.HEARTBEAT_ACK:
        this._heartbeatAck();
        break;
      case receiveEvent.PENDING_TICKET:
        this._pendingLogin(message);
        break;
      case receiveEvent.CANCEL:
        this.emit(Event.CANCEL, this);
        this.destroy();
        break;
      case receiveEvent.PENDING_LOGIN:
        this._ticket = message.ticket;
        this._findRealToken();
        break;
      default:
        break;
    }
  }

  _send(op, data) {
    if (!this._ws) return;
    let payload = { op };
    if (data != null) payload = Object.assign(payload, data);
    this._ws.send(JSON.stringify(payload));
  }

  _heartbeatAck() {
    setTimeout(() => this._send(sendEvent.HEARTBEAT), this._heartbeatInterval).unref();
  }

  _ready(data) {
    this._expire = new Date(Date.now() + data.timeout_ms);
    this._heartbeatInterval = data.heartbeat_interval;
    this._createKey();
    this._heartbeatAck();
    this._init();
  }

  _createKey() {
    const key = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    this._privateKey = key.privateKey;
    this._publicKey = key.publicKey;
  }

  _encodePublicKey() {
    return this._publicKey.split('\n').slice(1, -2).join('');
  }

  _init() {
    this._send(sendEvent.INIT, { encoded_public_key: this._encodePublicKey() });
  }

  _receiveNonceProof(data) {
    const decrypted = this._decryptPayload(data.encrypted_nonce);
    const proof = crypto.createHash('sha256').update(decrypted).digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').replace(/\s+$/, '');
    this._send(sendEvent.NONCE_PROOF, { proof });
  }

  _decryptPayload(encrypted_payload) {
    const payload = Buffer.from(encrypted_payload, 'base64');
    return crypto.privateDecrypt({
      key: this._privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, payload);
  }

  _pendingLogin(data) {
    const user_data = this._decryptPayload(data.encrypted_user_payload);
    this._userDecryptString = user_data.toString();
    this.emit(Event.WAIT_SCAN, this.user);
  }

  connect(client) {
    this._createWebSocket(wsURL);
    if (client) {
      return new Promise(resolve => {
        this.once(Event.FINISH, token => resolve(client.login(token)));
      });
    }
    return Promise.resolve();
  }

  destroy() {
    if (this._ws) this._ws.close();
    this.emit(Event.CLOSED);
  }

  generateQR() {
    if (!this._fingerprint) return;
    try {
      require('qrcode').toString(this.AuthURL, { type: 'utf8', errorCorrectionLevel: 'L' }, (err, url) => {
        if (!err) console.log(url);
      });
    } catch (e) {
      this.emit(Event.DEBUG, `QR URL: ${this.AuthURL}`);
    }
  }

  _findRealToken() {
    const props = Buffer.from(JSON.stringify({
      os: 'Windows',
      browser: 'Discord Client',
      release_channel: 'stable',
      client_version: '1.0.0',
      os_version: '10.0.22621',
      os_arch: 'x64',
      system_locale: 'en-US',
      client_build_number: 9999,
    }), 'ascii').toString('base64');

    return snekfetch.post('https://discord.com/api/v9/users/@me/remote-auth/login')
      .set('Content-Type', 'application/json')
      .set('User-Agent', Constants.UserAgent || 'Mozilla/5.0')
      .set('X-Super-Properties', props)
      .send({ ticket: this._ticket })
      .then(res => {
        if (res.body.encrypted_token) {
          this.token = this._decryptPayload(res.body.encrypted_token).toString();
        }
        this.emit(Event.FINISH, this.token);
        this.destroy();
      })
      .catch(() => false);
  }

  static decryptUser(payload) {
    const values = payload.split(':');
    return {
      id: values[0],
      username: values[3],
      discriminator: values[1],
      avatar: values[2],
    };
  }
}

module.exports = DiscordAuthWebsocket;
