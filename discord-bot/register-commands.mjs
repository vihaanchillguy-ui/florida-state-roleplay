const token = process.env.BOT_TOKEN;
const appId = process.env.APPLICATION_ID;
const guildId = process.env.GUILD_ID;
if (!token || !appId || !guildId) throw new Error("Set BOT_TOKEN, APPLICATION_ID and GUILD_ID before registering commands.");

const commands = [
  { name: "setup-support", description: "Publish the FSRP support ticket panel" },
  { name: "setup-applications", description: "Publish the FSRP staff application panel" },
  {
    name: "staff", description: "FSRP staff management commands", options: [
      { type: 1, name: "infraction", description: "Record a staff infraction", options: [
        { type: 6, name: "user", description: "Staff member receiving the infraction", required: true },
        { type: 3, name: "punishment", description: "Punishment issued", required: true, choices: ["Warning", "Strike", "Suspension", "Termination"].map(x => ({ name: x, value: x })) },
        { type: 3, name: "reason", description: "Reason for the infraction", required: true },
        { type: 3, name: "appeal_status", description: "Appeal status", required: true, choices: ["Pending", "Accepted", "Declined", "Not appealed"].map(x => ({ name: x, value: x })) }
      ]},
      { type: 1, name: "promotion", description: "Record a staff promotion", options: [
        { type: 6, name: "user", description: "Staff member being promoted", required: true },
        { type: 3, name: "rank", description: "New rank or position", required: true },
        { type: 3, name: "reason", description: "Reason for the promotion", required: false }
      ]}
    ]
  }
];
const response = await fetch(`https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands)
});
if (!response.ok) throw new Error(`Discord command registration failed: ${response.status} ${await response.text()}`);
console.log("FSRP slash commands registered.");
