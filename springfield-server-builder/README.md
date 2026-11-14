# Springfield Roleplay Server Builder

A separate Discord application and Cloudflare Worker for creating the Springfield Roleplay server layout.

## Important status
This is an initial scaffold, not a finished production bot. It creates categories, channels, and starter roles through Discord interactions. The verification button flow, ticket creation, safe retry/duplicate detection, and fine-grained department role assignment still need implementation and testing. Run it on a test server first.

## Requirements
- A separate Discord application/bot from Florida RP Command.
- Cloudflare Worker (Free plan).
- Bot invited with Manage Channels and Manage Roles permissions.
- Worker secrets: DISCORD_TOKEN and DISCORD_PUBLIC_KEY.
- Worker variable: CLIENT_ID.

Never commit bot tokens or private keys to GitHub.

## Deploy
1. Create a Cloudflare Worker named `springfield-roleplay-server-builder`.
2. Connect this folder/repository or deploy with Wrangler.
3. Add secrets `DISCORD_TOKEN` and `DISCORD_PUBLIC_KEY`.
4. Set `CLIENT_ID` in wrangler.toml to the new Discord application's Application ID.
5. Set the Discord Interactions Endpoint URL to the Worker URL.
6. Register slash commands using the script with environment variables DISCORD_TOKEN and CLIENT_ID.
7. Invite the bot with Manage Channels and Manage Roles. Test in a blank server first.

## Current layout
Start Here, Support, Community, Emergency Services, Traffic Stops (3 voice rooms), Staff Operations (3 staff scene voice rooms), Training, Offices, Applications & Whitelist, Events & Community, Store & Perks, General Voice.

Unverified users can view information and the support entry point; private categories are hidden by default. Verify role and department-specific access flows are not yet complete.
