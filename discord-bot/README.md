# Florida State Roleplay Discord Bot

Cloudflare Worker-based Discord interactions bot for FSRP. It uses Discord's HTTP interactions endpoint, so it does not need a continuously running Gateway process.

## Included

- Support panel with General Support, Staff Reports, Internal Affairs, Management Support, Partnerships, Player Reports, and Donations & Purchases.
- Private ticket channels with staff access and close controls.
- Separate staff application panel that can be published or removed by deleting its message.
- Staff application form and private review channel.
- Accept / decline decisions, with or without a reason.
- `/staff infraction` and `/staff promotion` commands with staff-role checks and logs.
- D1 persistence for tickets and applications.

## Free-tier note

Cloudflare Workers and D1 have free usage limits. This project does not configure paid services or billing. Usage above free limits may be rejected or require a plan change; do not upgrade or add billing unless the owner explicitly chooses to. Cloudflare may change its free-tier terms.

## 1. Create the Discord application

1. Open https://discord.com/developers/applications and create an application.
2. Add a bot under **Bot**, then copy its token. Keep it secret.
3. Enable the bot permissions needed to manage channels and send messages. Install it into the FSRP server with the required permissions.
4. Under **General Information**, copy the Application ID and Public Key.
5. Copy the FSRP server ID and the IDs of authorised staff roles.
6. Create private staff log and announcement channels, then copy their IDs.

## 2. Create Cloudflare resources

1. Sign in at https://dash.cloudflare.com/ and open Workers & Pages.
2. Create a D1 database named `fsrp-discord-bot`.
3. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with the database ID.
4. In a terminal, from this folder run:
   - `npm install`
   - `npx wrangler d1 execute fsrp-discord-bot --remote --file=./schema.sql`
5. Add Worker secrets:
   - `BOT_TOKEN`
   - `DISCORD_PUBLIC_KEY`
   - `APPLICATION_ID`
   - `GUILD_ID`
   - `STAFF_ROLE_IDS` (comma-separated role IDs)
   - `LOG_CHANNEL_ID`
   - `ANNOUNCEMENT_CHANNEL_ID`
6. Deploy with `npm run deploy`.

Do not put secrets in source files, GitHub, screenshots, or chat.

## 3. Connect Discord interactions

After deployment, copy the Worker URL and set Discord Developer Portal → General Information → **Interactions Endpoint URL** to:

`https://YOUR-WORKER.workers.dev/interactions`

Discord verifies the endpoint. If verification fails, check the Public Key secret and Worker logs.

## 4. Register commands

Set `BOT_TOKEN`, `APPLICATION_ID`, and `GUILD_ID` as local environment variables, then run:

`npm run register`

Commands are registered to the configured server:
- `/setup-support`
- `/setup-applications`
- `/staff infraction`
- `/staff promotion`

Only members with one of the configured `STAFF_ROLE_IDS` can publish panels or use staff actions.

## Important limitations / next work

- Removing the application panel means deleting its Discord message; applications already submitted remain in their private channels.
- This first version closes tickets by renaming the channel and logging the action. Transcript export, add/remove user controls, reopen controls, and a full appeal workflow are not implemented yet.
- The application panel can be removed and reposted at any time by authorised staff.
- Test with a private test channel and test roles before using this in the live FSRP server.
