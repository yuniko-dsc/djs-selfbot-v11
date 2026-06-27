
<div align="center">
  <br />
  <p>
    <a href="https://discord.js.org"><img src="https://discord.js.org/static/logo.svg" width="546" alt="discord.js" /></a>
  </p>
</div>

## About

<strong>Welcome to `djs-selfbot-v11@v11.10`, based on `discord.js@11.6` with backports from `djs-selfbot-v13`</strong>

- djs-selfbot-v11 is a [Node.js](https://nodejs.org) module that allows user accounts to interact with the Discord API.

> [!IMPORTANT]
> **This project is a fork maintained for discord.js v11 selfbots, with features ported from [djs-selfbot-v13](https://github.com/002-sans/djs-selfbot-v13).**

---

## Nouveautés

Comparé au module original `discord.js-selfbot-v11`, ce fork ajoute de nouvelles classes, managers, méthodes et options. Liste complète dans [NOUVEAUTES.md](./NOUVEAUTES.md).

### Nouveaux managers (`client.*`)

| Manager | Accès | Description |
|---------|-------|-------------|
| `RelationshipManager` | `client.relationships` | Amis, blocages, demandes entrantes/sortantes |
| `UserNoteManager` | `client.notes` | Notes utilisateur |
| `BillingManager` | `client.billing` | Paiements, boosts, abonnements |
| `DeveloperManager` | `client.developers` | Applications développeur |
| `SessionManager` | `client.sessions` | Sessions actives |
| `BackupManager` | `client.backups` | Sauvegarde/restauration de serveurs |
| `QuestManager` | `client.quests` | Quêtes Discord |

### Client — Nouvelles méthodes

| Méthode | Description |
|---------|-------------|
| `isReady()` | Vérifie si le client est prêt |
| `logout()` | Déconnexion + destruction |
| `QRLogin()` | Connexion par QR code (Remote Auth) |
| `passLogin(email, password)` | Connexion email/mot de passe (+ TOTP) |
| `acceptInvite(invite, options)` | Rejoindre avec bypass onboarding/vérification |
| `redeemNitro(nitro, channel?, paymentSourceId?)` | Activer un code Nitro |
| `authorizeURL(urlOAuth2, options)` | Autoriser une app OAuth2 |
| `installUserApps(applicationId)` | Installer une User App |
| `deauthorize(id, type?)` | Révoquer une autorisation |
| `authorizedApplications()` | Liste des apps autorisées |

### ClientUser — Présence & profil

| Méthode | Description |
|---------|-------------|
| `setPresence(options, shardId?)` | Statut, activités, RichPresence, CustomStatus |
| `setCustomStatus(options, shardId?)` | Statut personnalisé via REST |
| `patchCustomStatus(options)` | PATCH REST sans OP 3 |
| `setGlobalName(globalName)` | Nom d'affichage global |
| `setBanner(banner)` | Bannière de profil |
| `createFriendInvite()` | Lien d'invitation ami |
| `getAllFriendInvites()` | Liste les invitations ami |

### RichPresence / CustomStatus

- `RichPresence.setPlatform()` — `desktop`, `android`, `ios`, `xbox`, `ps4`, `ps5`, etc.
- `setDetailsURL()`, `setStateURL()`, `setSessionId()`, `addButton()`
- `RichPresence.getExternal()` — images externes via `/applications/:id/external-assets`
- `CustomStatus` avec auto-sync REST

### Quêtes (`client.quests`)

```js
await client.quests.get();
const quest = client.quests.getQuest('QUEST_ID');
await client.quests.acceptQuest('QUEST_ID');
await client.quests.watchVideo('QUEST_ID', { duration: 30 });
await client.quests.claimQuest('QUEST_ID');
```

### Sauvegardes (`client.backups`)

```js
const backup = await client.backups.cache.create(guild.id, {
  maxMessagesPerChannel: 50,
  backupMembers: true,
});
await client.backups.cache.load(guild.id, backup.id);
```

### Relations

```js
await client.relationships.fetch();
await user.sendFriendRequest();
await client.relationships.addFriend(user);
```

---

<div align="center">
  <p>
    <a href="https://www.npmjs.com/package/djs-selfbot-v11"><img src="https://img.shields.io/npm/v/djs-selfbot-v11.svg" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/djs-selfbot-v11"><img src="https://img.shields.io/npm/dt/djs-selfbot-v11.svg" alt="npm downloads" /></a>
    <a href="https://github.com/002-sans/djs-selfbot-v11"><img src="https://img.shields.io/github/stars/002-sans/djs-selfbot-v11.svg" alt="GitHub stars" /></a>
  </p>
</div>

> [!WARNING]
> **I don't take any responsibility for blocked Discord accounts that used this module.**

> [!CAUTION]
> **Using this on a user account is prohibited by the [Discord TOS](https://discord.com/terms) and can lead to the account block.**

### <strong>[Documentation](./docs/main.json)</strong>

### <strong>[Changelog / Nouveautés](./NOUVEAUTES.md)</strong>

## Features (User)
- [x] Message
- [x] ClientUser: Status, Activity, RemoteAuth, CustomStatus, RichPresence, etc.
- [x] Guild: Fetch Members, Join / Leave, Preview, Widget, etc.
- [x] Relationships: Friends, blocks, nicknames
- [x] Quests: Enroll, watch video, claim rewards
- [x] Backups: Sauvegarde/restauration de serveurs
- [x] Developer: Gestion des applications
- [x] OAuth2: authorize, deauthorize, user apps
- [x] Billing: Payment sources, boosts, subscriptions
- [x] QR Login / passLogin (TOTP)
- [x] Voice broadcast (v11 natif)
- [ ] Voice WebRTC / Go Live (v13 only)
- [ ] Interactions complètes (Modal, SelectMenu, Poll)
- [ ] Documentation website

## Installation

> [!NOTE]
> **Node.js 6.0.0 or newer is required**

```sh-session
npm install djs-selfbot-v11@latest
```

## Example

```js
const { Client } = require('djs-selfbot-v11');
const client = new Client();

client.on('ready', async () => {
  console.log(`${client.user.username} is ready!`);
});

client.login('token');
```

## Get Token ?

- Based: [findByProps](https://discord.com/channels/603970300668805120/1085682686607249478/1085682686607249478)

<strong>Run code (Discord Console - [Ctrl + Shift + I])</strong>

```js
window.webpackChunkdiscord_app.push([
	[Symbol()],
	{},
	req => {
		if (!req.c) return;
		for (let m of Object.values(req.c)) {
			try {
				if (!m.exports || m.exports === window) continue;
				if (m.exports?.getToken) return copy(m.exports.getToken());
				for (let ex in m.exports) {
					if (m.exports?.[ex]?.getToken && m.exports[ex][Symbol.toStringTag] !== 'IntlMessagesProxy') return copy(m.exports[ex].getToken());
				}
			} catch {}
		}
	},
]);

window.webpackChunkdiscord_app.pop();
console.log('%cWorked!', 'font-size: 50px');
console.log(`%cYou now have your token in the clipboard!`, 'font-size: 16px');
```

## Contributing

- Before creating an issue, please ensure that it hasn't already been reported/suggested, and double-check the
[documentation](./docs/main.json).
- See [the contribution guide](https://github.com/discordjs/discord.js/blob/main/.github/CONTRIBUTING.md) if you'd like to submit a PR.

## Need help?

Github: [002-sans/djs-selfbot-v11](https://github.com/002-sans/djs-selfbot-v11)

## Credits
- [Discord.js](https://github.com/discordjs/discord.js)
- [djs-selfbot-v13](https://github.com/002-sans/djs-selfbot-v13)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=002-sans/djs-selfbot-v11&type=Date)](https://star-history.com/#002-sans/djs-selfbot-v11&Date)
