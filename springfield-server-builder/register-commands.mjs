const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) throw new Error("Set DISCORD_TOKEN and CLIENT_ID environment variables.");
const commands = [
  { name: "setup-server", description: "Create the Springfield Roleplay server layout and access roles" },
  { name: "setup-verification", description: "Post the member verification panel", options: [{ name: "channel", description: "Channel ID for the verification panel", type: 3, required: true }] }
];
const response = await fetch(`https://discord.com/api/v10/applications/${clientId}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands)
});
if (!response.ok) throw new Error(await response.text());
console.log("Registered slash commands.");
