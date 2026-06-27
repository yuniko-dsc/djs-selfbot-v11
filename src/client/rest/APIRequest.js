const snekfetch = require('snekfetch');
const Constants = require('../../util/Constants');
const { HttpsProxyAgent } = require('https-proxy-agent');
let proxyagent = null;
class APIRequest {
  constructor(rest, method, path, auth, data, files, reason, contextmenu) {
    this.rest = rest;
    this.client = rest.client;
    this.method = method;
    this.path = path.toString();
    this.auth = auth;
    this.data = data;
    this.files = files;
    this.route = this.getRoute(this.path);
    this.reason = reason;
    this.contextmenu = contextmenu;
  }

  getRoute(url) {
    const route = url.split('?')[0].split('/');
    const routeBucket = [];
    for (let i = 0; i < route.length; i++) {
      // Reactions routes and sub-routes all share the same bucket
      if (route[i - 1] === 'reactions') break;
      // Literal IDs should only be taken account if they are the Major ID (the Channel/Guild ID)
      if (/\d{16,19}/g.test(route[i]) && !/channels|guilds/.test(route[i - 1])) routeBucket.push(':id');
      // All other parts of the route should be considered as part of the bucket identifier
      else routeBucket.push(route[i]);
    }
    return routeBucket.join('/');
  }

  getAuth() {
    if (this.client.token && this.client.user && this.client.user.bot) {
      return `Bot ${this.client.token}`;
    } else if (this.client.token) {
      return this.client.token;
    }
    throw new Error(Constants.Errors.NO_TOKEN);
  }

  gen(captchaKey = undefined, captchaRqtoken = undefined) {
    const API = `${this.client.options.http.host}/api/v${this.client.options.http.version}`;
    if (proxyagent === null && typeof this.client.options.proxy === 'string' && this.client.options.proxy.length > 0) {
      proxyagent = new HttpsProxyAgent(`${this.client.options.proxy}`, { keepAlive: true });
    }
    const request = snekfetch[this.method](`${API}${this.path}`, { agent: proxyagent });
    if (this.reason) request.set('X-Audit-Log-Reason', encodeURIComponent(this.reason));
    if (this.contextmenu) request.set('X-Context-Properties', this.contextmenu)
    request.set('authority', 'discord.com');
    request.set('accept', "*/*");
    request.set("accept-language", "en-US");
    if (this.auth) request.set('Authorization', this.getAuth());
    if (this.client.cookie) request.set('Cookie', this.client.cookie);
    request.set("sec-ch-ua", `"Not?A_Brand";v="8", "Chromium";v="108"`);
    request.set("sec-ch-ua-mobile", "?0");
    request.set("sec-ch-ua-platform", '"Windows"');
    request.set("sec-fetch-dest", 'empty');
    request.set('sec-fetch-mode', "cors");
    request.set("sec-fetch-site", "same-origin");
    if (!this.rest.client.browser) request.set('User-Agent', this.rest.userAgentManager.userAgent);
    request.set(`X-Debug-Options`, "bugReporterEnabled");
    request.set(`X-Discord-Locale`, "en-US");
    request.set(`X-Discord-Timezone`, "Europe/Paris");
    request.set("X-Super-Properties", `${Buffer.from(
      this.client.options.jsonTransformer(this.client.options.ws.properties),
      'ascii',
    ).toString('base64')}`);
    if (captchaKey && typeof captchaKey == 'string') {
      request.set('X-Captcha-Key', captchaKey);
      if (captchaRqtoken) request.set('X-Captcha-Rqtoken', captchaRqtoken);
    }
    if (this.client.fingerprint) request.set('fingerprint', this.client.fingerprint);
    if (this.files) {
      for (const file of this.files) if (file && file.file) request.attach(file.name, file.file, file.name);
      if (typeof this.data !== 'undefined') request.attach('payload_json', JSON.stringify(this.data));
    } else if (this.data) {
      request.send(this.data);
    }
    return request;
  }
}

module.exports = APIRequest;
