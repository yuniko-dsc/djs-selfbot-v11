const Constants = require('../../util/Constants');

class UserAgentManager {
  constructor() {
    this.build();
  }

  set() {
    this.build();
  }

  build() {
    this.userAgent = `Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9020 Chrome/108.0.5359.215 Electron/22.3.26 Safari/537.36`;
  }
}

UserAgentManager.DEFAULT = {
  url: Constants.Package.homepage.split('#')[0],
  version: Constants.Package.version,
};

module.exports = UserAgentManager;
