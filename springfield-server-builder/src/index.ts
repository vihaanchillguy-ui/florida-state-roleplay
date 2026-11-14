export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_TOKEN: string;
  CLIENT_ID: string;
}
const API = "https://discord.com/api/v10";
const P = { VIEW: "1024", SEND: "2048", READ_HISTORY: "65536", CONNECT: "1048576", SPEAK: "2097152", MANAGE_CHANNELS: "16", MANAGE_ROLES: "268435456" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
function hexToBytes(hex: string) { return new Uint8Array(hex.match(/.{1,2}/g)!.map(x => parseInt(x, 16))); }
async function verify(req: Request, raw: string, key: string) {
  const sig = req.headers.get("X-Signature-Ed25519"), timestamp = req.headers.get("X-Signature-Timestamp");
  if (!sig || !timestamp) return false;
  try {
    const cryptoKey = await crypto.subtle.importKey("raw", hexToBytes(key), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", cryptoKey, hexToBytes(sig), new TextEncoder().encode(timestamp + raw));
  } catch { return false; }
}
async function discord(env: Env, path: string, method = "GET", body?: unknown) {
  const r = await fetch(API + path, { method, headers: { Authorization: "Bot " + env.DISCORD_TOKEN, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error("Discord API " + r.status + ": " + t.slice(0, 500));
  return t ? JSON.parse(t) : null;
}
const msg = (content: string, ephemeral = true) => ({ type: 4, data: { content, flags: ephemeral ? 64 : 0 } });
async function createRole(env: Env, guild: string, name: string, color: number, permissions = "0") {
  return discord(env, `/guilds/${guild}/roles`, "POST", { name, color, permissions, mentionable: false, hoist: true });
}
async function createCategory(env: Env, guild: string, name: string, overwrites: any[]) {
  return discord(env, `/guilds/${guild}/channels`, "POST", { name, type: 4, permission_overwrites: overwrites });
}
async function createChannel(env: Env, guild: string, name: string, type: 0 | 2, parent: string, overwrites?: any[]) {
  return discord(env, `/guilds/${guild}/channels`, "POST", { name, type, parent_id: parent, ...(overwrites ? { permission_overwrites: overwrites } : {}) });
}
async function setup(env: Env, guild: string) {
  const roles = await discord(env, `/guilds/${guild}/roles`);
  const everyone = roles.find((r: any) => r.name === "@everyone");
  const verified = await createRole(env, guild, "Verified", 0x3498db);
  const staff = await createRole(env, guild, "Staff", 0xe74c3c);
  const police = await createRole(env, guild, "Police", 0x206694);
  const fire = await createRole(env, guild, "Fire & Rescue", 0xc0392b);
  const ems = await createRole(env, guild, "EMS", 0x2ecc71);
  const overwrites = (allowVerified = true, allowStaff = true) => [
    { id: everyone.id, type: 0, deny: P.VIEW, allow: "0" },
    ...(allowVerified ? [{ id: verified.id, type: 0, allow: P.VIEW + "," + P.SEND + "," + P.READ_HISTORY + "," + P.CONNECT + "," + P.SPEAK, deny: "0" }] : []),
    ...(allowStaff ? [{ id: staff.id, type: 0, allow: P.VIEW + "," + P.SEND + "," + P.READ_HISTORY + "," + P.CONNECT + "," + P.SPEAK, deny: "0" }] : [])
  ];
  const publicOverwrites = [
    { id: everyone.id, type: 0, allow: P.VIEW + "," + P.READ_HISTORY, deny: P.SEND },
    { id: staff.id, type: 0, allow: P.VIEW + "," + P.SEND + "," + P.READ_HISTORY, deny: "0" }
  ];
  const ticketOverwrites = [
    { id: everyone.id, type: 0, allow: P.VIEW + "," + P.READ_HISTORY, deny: P.SEND },
    { id: staff.id, type: 0, allow: P.VIEW + "," + P.SEND + "," + P.READ_HISTORY, deny: "0" }
  ];
  const categories: { name: string; channels: [string, 0 | 2][]; mode: "public" | "verified" | "staff" | "department" | "ticket" }[] = [
    { name: "📌 START HERE", mode: "public", channels: [["welcome",0],["rules",0],["server-information",0],["faq",0],["verification",0],["arrivals",0]] },
    { name: "🎫 SUPPORT", mode: "public", channels: [["open-a-ticket",0],["ticket-updates",0]] },
    { name: "💬 COMMUNITY", mode: "verified", channels: [["general",0],["bot-commands",0],["polls",0],["suggestions",0],["media",0],["clips",0],["giveaways",0]] },
    { name: "🚨 EMERGENCY SERVICES", mode: "department", channels: [["emergency-services-chat",0],["department-announcements",0],["police-chat",0],["fire-rescue-chat",0],["ems-chat",0],["Police Radio",2],["Fire Radio",2],["EMS Radio",2]] },
    { name: "🚦 TRAFFIC STOPS", mode: "department", channels: [["Traffic Stop 1",2],["Traffic Stop 2",2],["Traffic Stop 3",2]] },
    { name: "🛡️ STAFF OPERATIONS", mode: "staff", channels: [["staff-chat",0],["staff-announcements",0],["staff-roster",0],["staff-logs",0],["disciplinary-logs",0],["Staff Scene 1",2],["Staff Scene 2",2],["Staff Scene 3",2]] },
    { name: "🎓 TRAINING", mode: "department", channels: [["training-announcements",0],["training-materials",0],["training-schedule",0],["training-results",0],["Training Room 1",2],["Training Room 2",2]] },
    { name: "🏢 OFFICES", mode: "staff", channels: [["police-office",0],["fire-rescue-office",0],["ems-office",0],["management-office",0]] },
    { name: "📝 APPLICATIONS & WHITELIST", mode: "verified", channels: [["staff-applications",0],["department-applications",0],["whitelist-information",0],["whitelist-applications",0]] },
    { name: "🎉 EVENTS & COMMUNITY", mode: "verified", channels: [["event-announcements",0],["winners",0],["partnerships",0],["paid-advertisements",0],["affiliates",0]] },
    { name: "🛍️ STORE & PERKS", mode: "verified", channels: [["merch-shop",0],["supporter-perks",0],["premium-benefits",0]] },
    { name: "🔊 GENERAL VOICE", mode: "verified", channels: [["General VC",2],["Gaming Lounge",2],["Waiting Room",2]] }
  ];
  const made: string[] = [];
  for (const cat of categories) {
    let ow: any[];
    if (cat.mode === "public") ow = publicOverwrites;
    else if (cat.mode === "ticket") ow = ticketOverwrites;
    else if (cat.mode === "staff") ow = [{ id: everyone.id, type: 0, deny: P.VIEW, allow: "0" }, { id: staff.id, type: 0, allow: P.VIEW + "," + P.SEND + "," + P.READ_HISTORY + "," + P.CONNECT + "," + P.SPEAK, deny: "0" }];
    else if (cat.mode === "department") ow = [{ id: everyone.id, type: 0, deny: P.VIEW, allow: "0" }, { id: verified.id, type: 0, allow: P.VIEW + "," + P.READ_HISTORY, deny: P.SEND }, { id: staff.id, type: 0, allow: P.VIEW + "," + P.SEND + "," + P.READ_HISTORY + "," + P.CONNECT + "," + P.SPEAK, deny: "0" }];
    else ow = overwrites();
    const parent = await createCategory(env, guild, cat.name, ow); made.push(cat.name);
    for (const [name, type] of cat.channels) {
      await createChannel(env, guild, name, type, parent.id);
    }
  }
  return { made, roles: [verified.name, staff.name, police.name, fire.name, ems.name] };
}
async function registerCommands(env: Env) {
  const commands = [
    { name: "setup-server", description: "Create the Springfield Roleplay server layout and access roles" },
    { name: "setup-verification", description: "Post the member verification panel", options: [{ name: "channel", description: "Channel ID for the verification panel", type: 3, required: true }] }
  ];
  await discord(env, `/applications/${env.CLIENT_ID}/commands`, "PUT", commands);
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "GET") return new Response("Springfield Roleplay Server Builder is online.");
    const raw = await req.text();
    if (!(await verify(req, raw, env.DISCORD_PUBLIC_KEY))) return new Response("Invalid request signature", { status: 401 });
    const interaction = JSON.parse(raw);
    if (interaction.type === 1) return json({ type: 1 });
    const name = interaction.data?.name;
    if (name === "setup-server") {
      try {
        const result = await setup(env, interaction.guild_id);
        return json(msg("✅ Springfield Roleplay layout created. Categories: " + result.made.length + ". Roles created: " + result.roles.join(", ") + ".\n\nNote: department role assignments and the interactive verification button still need configuring."));
      } catch (e) { return json(msg("❌ Setup stopped: " + (e as Error).message)); }
    }
    if (name === "setup-verification") return json(msg("Verification panel setup is the next feature to enable. The channel option was received."));
    return json(msg("Unknown command."));
  }
};