export interface Env {
  BOT_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  APPLICATION_ID: string;
  GUILD_ID: string;
  STAFF_ROLE_IDS: string;
  LOG_CHANNEL_ID?: string;
  ANNOUNCEMENT_CHANNEL_ID?: string;
  DB: D1Database;
}

const API = "https://discord.com/api/v10";
const SUPPORT_CATEGORIES = [
  ["general_support", "General Support"],
  ["staff_reports", "Staff Reports"],
  ["internal_affairs", "Internal Affairs"],
  ["management_support", "Management Support"],
  ["partnerships", "Partnerships"],
  ["player_reports", "Player Reports"],
  ["donations_purchases", "Donations & Purchases"],
] as const;

type Interaction = {
  id: string; application_id: string; type: number; token: string;
  guild_id?: string; channel_id?: string; member?: { user?: { id: string; username: string }; roles?: string[] };
  user?: { id: string; username: string };
  data?: { name?: string; custom_id?: string; options?: any[]; components?: any[]; resolved?: any };
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json" }
});
const ephemeral = (content: string) => ({ type: 4, data: { content, flags: 64 } });
const rows = (components: any[]) => components.map(c => ({ type: 1, components: [c] }));
const button = (label: string, custom_id: string, style = 1) => ({ type: 2, style, label, custom_id });

async function verify(req: Request, body: string, publicKey: string): Promise<boolean> {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  if (!signature || !timestamp) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hex(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, hex(signature), new TextEncoder().encode(timestamp + body));
  } catch { return false; }
}
function hex(s: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(s)) throw new Error("Invalid hex");
  return new Uint8Array(s.match(/.{2}/g)!.map(x => parseInt(x, 16)));
}
async function discord(env: Env, path: string, init: RequestInit = {}) {
  const response = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bot ${env.BOT_TOKEN}`, "Content-Type": "application/json", ...(init.headers || {}) }
  });
  if (!response.ok) throw new Error(`Discord API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json<any>();
}
function staff(interaction: Interaction, env: Env): boolean {
  const roles = interaction.member?.roles || [];
  const allowed = env.STAFF_ROLE_IDS.split(",").map(x => x.trim()).filter(Boolean);
  return roles.some(role => allowed.includes(role));
}
function modal(custom_id: string, title: string, fields: Array<[string, string, boolean?]>) {
  return { type: 9, data: { custom_id, title, components: fields.map(([id, label, paragraph]) => ({
    type: 1, components: [{ type: 4, custom_id: id, label, style: paragraph ? 2 : 1, required: true, max_length: paragraph ? 1000 : 100 }]
  })) } };
}
function values(data: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of data.components || []) for (const field of row.components || []) out[field.custom_id] = field.value || "";
  return out;
}
async function createPrivateChannel(env: Env, guildId: string, name: string, userId: string, topic: string) {
  const staffRoles = env.STAFF_ROLE_IDS.split(",").map(x => x.trim()).filter(Boolean);
  const overwrites = [
    { id: guildId, type: 0, deny: "1024" },
    { id: userId, type: 1, allow: "1024" },
    ...staffRoles.map(id => ({ id, type: 0, allow: "1024" }))
  ];
  return discord(env, `/guilds/${guildId}/channels`, {
    method: "POST", body: JSON.stringify({ name, type: 0, topic, permission_overwrites: overwrites })
  });
}
async function sendChannel(env: Env, channelId: string, payload: any) {
  return discord(env, `/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(payload) });
}
async function log(env: Env, content: string) {
  if (env.LOG_CHANNEL_ID) await sendChannel(env, env.LOG_CHANNEL_ID, { content });
}
async function handleCommand(i: Interaction, env: Env) {
  const name = i.data?.name;
  if (name === "setup-support" || name === "setup-applications") {
    if (!staff(i, env)) return ephemeral("You do not have permission to configure FSRP panels.");
    if (!i.channel_id) return ephemeral("Run this command inside a server channel.");
    if (name === "setup-support") {
      const components = SUPPORT_CATEGORIES.map(([id, label]) => button(label, `ticket:${id}`));
      const componentRows = [components.slice(0, 4), components.slice(4)].map(group => ({ type: 1, components: group }));
      await sendChannel(env, i.channel_id, {
        embeds: [{ title: "Florida State Roleplay | Support Centre", description: "Select a category below to open a private support ticket. Please provide clear information so our team can assist you.", color: 0x001B3A, footer: { text: "Florida State Roleplay | Support Services" } }],
        components: componentRows
      });
    } else {
      await sendChannel(env, i.channel_id, {
        embeds: [{ title: "Florida State Roleplay | Staff Recruitment", description: "Interested in joining the FSRP staff team? Submit an application below. Your application will be private and reviewed by authorised management.", color: 0x001B3A, footer: { text: "Florida State Roleplay | Recruitment" } }],
        components: [{ type: 1, components: [button("Apply for Staff", "application:start", 1)] }]
      });
    }
    return ephemeral("Panel published.");
  }
  if (name === "staff") {
    if (!staff(i, env)) return ephemeral("You do not have permission to use FSRP staff commands.");
    const sub = i.data?.options?.[0];
    const opts = sub?.options || [];
    const get = (key: string) => opts.find((o: any) => o.name === key);
    const target = get("user")?.value || get("member")?.value;
    const reason = get("reason")?.value || "No reason provided.";
    const action = sub?.name;
    if (!target) return ephemeral("A target user is required.");
    const user = i.data?.resolved?.users?.[target];
    const mention = `<@${target}>`;
    if (action === "infraction") {
      const punishment = get("punishment")?.value || "Unspecified";
      const appeal = get("appeal_status")?.value || "Not appealed";
      const embed = { title: "Staff Infraction Recorded", color: 0x001B3A, fields: [
        { name: "Staff Member", value: mention, inline: true },
        { name: "Punishment", value: punishment, inline: true },
        { name: "Appeal Status", value: appeal, inline: true },
        { name: "Reason", value: reason },
        { name: "Issued By", value: `<@${i.member?.user?.id || i.user?.id}>`, inline: true }
      ], timestamp: new Date().toISOString(), footer: { text: "Florida State Roleplay | Staff Records" } };
      const channel = env.LOG_CHANNEL_ID || env.ANNOUNCEMENT_CHANNEL_ID;
      if (!channel) return ephemeral("Configure LOG_CHANNEL_ID in Cloudflare Worker settings first.");
      await sendChannel(env, channel, { embeds: [embed] });
      return ephemeral(`Infraction recorded for ${mention}.`);
    }
    if (action === "promotion") {
      const rank = get("rank")?.value || "Unspecified";
      const channel = env.ANNOUNCEMENT_CHANNEL_ID || env.LOG_CHANNEL_ID;
      if (!channel) return ephemeral("Configure ANNOUNCEMENT_CHANNEL_ID in Cloudflare Worker settings first.");
      await sendChannel(env, channel, { embeds: [{ title: "Staff Promotion", color: 0x001B3A, description: `${mention} has been promoted to **${rank}**.\n\n**Reason:** ${reason}\n**Approved by:** <@${i.member?.user?.id || i.user?.id}>`, timestamp: new Date().toISOString(), footer: { text: "Florida State Roleplay | Staff Management" } }] });
      return ephemeral(`Promotion recorded for ${mention}.`);
    }
  }
  return ephemeral("Unknown command.");
}
async function handleComponent(i: Interaction, env: Env) {
  const id = i.data?.custom_id || "";
  const userId = i.member?.user?.id || i.user?.id || "";
  const guildId = i.guild_id;
  if (!guildId || !userId) return ephemeral("This feature can only be used inside the FSRP server.");
  if (id.startsWith("ticket:")) {
    const category = SUPPORT_CATEGORIES.find(([key]) => key === id.slice(7));
    if (!category) return ephemeral("Unknown ticket category.");
    return modal(`ticket-submit:${category[0]}`, "Open a Support Ticket", [
      ["subject", "What do you need help with?"],
      ["details", "Describe the issue and include relevant details.", true]
    ]);
  }
  if (id === "application:start") {
    return modal("application:submit", "FSRP Staff Application", [
      ["roblox", "Roblox username"],
      ["discord", "Discord username"],
      ["age", "Age"],
      ["experience", "Previous staff / roleplay experience", true],
      ["why", "Why do you want to join FSRP staff?", true]
    ]);
  }
  if (id.startsWith("application:decision:")) {
    if (!staff(i, env)) return ephemeral("Only authorised staff can review applications.");
    const [, , decision, appId] = id.split(":");
    const app = await env.DB.prepare("SELECT * FROM applications WHERE id = ? AND status = 'pending'").bind(appId).first<any>();
    if (!app) return ephemeral("This application is no longer pending or could not be found.");
    const reviewer = i.member?.user?.id || i.user?.id;
    await env.DB.prepare("UPDATE applications SET status = ?, reviewed_by = ?, reviewed_at = ?, decision_reason = NULL WHERE id = ?")
      .bind(decision, reviewer, new Date().toISOString(), appId).run();
    await sendChannel(env, app.channel_id, { embeds: [{ title: decision === "accepted" ? "Application Accepted" : "Application Declined", description: `Your FSRP staff application has been **${decision}**.\nNo additional reason was provided.`, color: decision === "accepted" ? 0x238636 : 0xB42318, footer: { text: "Florida State Roleplay | Recruitment" } }] });
    await log(env, `Application ${appId} ${decision} by <@${reviewer}>.`);
    return ephemeral(`Application ${decision}.`);
  }
  if (id.startsWith("application:reason:")) {
    if (!staff(i, env)) return ephemeral("Only authorised staff can review applications.");
    const [, , decision, appId] = id.split(":");
    return modal(`application:reason-submit:${decision}:${appId}`, decision === "accepted" ? "Accept Application" : "Decline Application", [["reason", "Decision reason", true]]);
  }
  return ephemeral("Unknown button.");
}
async function handleModal(i: Interaction, env: Env) {
  const id = i.data?.custom_id || "";
  const fields = values(i.data);
  const userId = i.member?.user?.id || i.user?.id || "";
  const guildId = i.guild_id;
  if (!guildId || !userId) return ephemeral("This form must be submitted in the FSRP server.");
  if (id.startsWith("ticket-submit:")) {
    const category = SUPPORT_CATEGORIES.find(([key]) => key === id.slice("ticket-submit:".length));
    if (!category) return ephemeral("Unknown ticket category.");
    const channel = await createPrivateChannel(env, guildId, `ticket-${category[0]}-${userId.slice(-4)}`, userId, `FSRP ticket | ${category[1]} | opener ${userId}`);
    await sendChannel(env, channel.id, { embeds: [{ title: category[1], description: `**Opened by:** <@${userId}>\n**Subject:** ${fields.subject}\n\n**Details:**\n${fields.details}`, color: 0x001B3A, footer: { text: "Florida State Roleplay | Support Services" } }], components: [{ type: 1, components: [button("Close Ticket", `ticket:close:${channel.id}`, 4)] }] });
    await env.DB.prepare("INSERT INTO tickets (channel_id, opener_id, category, status, created_at) VALUES (?, ?, ?, 'open', ?)")
      .bind(channel.id, userId, category[0], new Date().toISOString()).run();
    return ephemeral(`Your ticket has been created: <#${channel.id}>`);
  }
  if (id === "application:submit") {
    const channel = await createPrivateChannel(env, guildId, `application-${userId.slice(-4)}`, userId, `FSRP staff application | applicant ${userId}`);
    const result = await env.DB.prepare("INSERT INTO applications (applicant_id, channel_id, roblox_username, discord_username, age, experience, motivation, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)")
      .bind(userId, channel.id, fields.roblox, fields.discord, fields.age, fields.experience, fields.why, new Date().toISOString()).run();
    const appId = String(result.meta.last_row_id);
    await sendChannel(env, channel.id, { embeds: [{ title: "New FSRP Staff Application", color: 0x001B3A, fields: [
      { name: "Applicant", value: `<@${userId}>`, inline: true }, { name: "Roblox Username", value: fields.roblox, inline: true },
      { name: "Discord Username", value: fields.discord, inline: true }, { name: "Age", value: fields.age, inline: true },
      { name: "Experience", value: fields.experience }, { name: "Why FSRP?", value: fields.why }
    ], footer: { text: `Application #${appId} | Pending Review` } }], components: [
      { type: 1, components: [button("Accept", `application:decision:accepted:${appId}`, 3), button("Decline", `application:decision:declined:${appId}`, 4)] },
      { type: 1, components: [button("Accept with reason", `application:reason:accepted:${appId}`, 2), button("Decline with reason", `application:reason:declined:${appId}`, 2)] }
    ] });
    return ephemeral(`Your application has been submitted: <#${channel.id}>`);
  }
  if (id.startsWith("application:reason-submit:")) {
    if (!staff(i, env)) return ephemeral("Only authorised staff can review applications.");
    const [, , , decision, appId] = id.split(":");
    const app = await env.DB.prepare("SELECT * FROM applications WHERE id = ? AND status = 'pending'").bind(appId).first<any>();
    if (!app) return ephemeral("This application is no longer pending.");
    const reviewer = userId;
    await env.DB.prepare("UPDATE applications SET status = ?, reviewed_by = ?, reviewed_at = ?, decision_reason = ? WHERE id = ?")
      .bind(decision, reviewer, new Date().toISOString(), fields.reason, appId).run();
    await sendChannel(env, app.channel_id, { embeds: [{ title: decision === "accepted" ? "Application Accepted" : "Application Declined", description: `Your FSRP staff application has been **${decision}**.\n\n**Reason:** ${fields.reason}`, color: decision === "accepted" ? 0x238636 : 0xB42318 }] });
    await log(env, `Application ${appId} ${decision} by <@${reviewer}>. Reason: ${fields.reason}`);
    return ephemeral(`Application ${decision} with reason.`);
  }
  return ephemeral("Unknown form.");
}
async function closeTicket(i: Interaction, env: Env) {
  const id = i.data?.custom_id || "";
  const channelId = id.slice("ticket:close:".length);
  if (!staff(i, env)) return ephemeral("Only authorised staff can close tickets.");
  await env.DB.prepare("UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ? AND status = 'open'")
    .bind(new Date().toISOString(), channelId).run();
  await discord(env, `/channels/${channelId}`, { method: "PATCH", body: JSON.stringify({ name: `closed-${channelId.slice(-4)}` }) });
  await log(env, `Ticket <#${channelId}> closed by <@${i.member?.user?.id || i.user?.id}>.`);
  return ephemeral("Ticket closed.");
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/") return new Response("Florida State Roleplay Discord bot endpoint is online.");
    if (req.method !== "POST" || url.pathname !== "/interactions") return new Response("Not found", { status: 404 });
    const body = await req.text();
    if (!await verify(req, body, env.DISCORD_PUBLIC_KEY)) return new Response("Invalid request signature", { status: 401 });
    const i = JSON.parse(body) as Interaction;
    if (i.type === 1) return json({ type: 1 });
    try {
      if (i.type === 2) return json(await handleCommand(i, env));
      if (i.type === 3) {
        if ((i.data?.custom_id || "").startsWith("ticket:close:")) return json(await closeTicket(i, env));
        return json(await handleComponent(i, env));
      }
      if (i.type === 5) return json(await handleModal(i, env));
      return json(ephemeral("Unsupported interaction."));
    } catch (error) {
      console.error(error);
      return json(ephemeral("Something went wrong. Please contact FSRP management."));
    }
  }
};
