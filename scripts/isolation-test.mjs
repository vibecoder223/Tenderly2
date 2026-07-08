// Two-tenant data-isolation proof. Seeds Org A + Org B via service role, then
// signs in as each user with the ANON key (so RLS applies) and checks that
// neither can read or write the other's rows. Cleans up all test data at the end.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const txt = await readFile(".env.local", "utf8");
const env = {};
for (const line of txt.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

const stamp = Date.now();
const pass = "Test!" + stamp + "aZ";
let pass_count = 0, fail_count = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass_count++ : fail_count++;
};

const created = { users: [], orgs: [] };
async function mkTenant(tag) {
  const email = `isotest+${tag}-${stamp}@example.com`;
  const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: pass, email_confirm: true });
  if (ue) throw new Error(`createUser ${tag}: ${ue.message}`);
  created.users.push(u.user.id);
  const { data: org, error: oe } = await admin.from("organizations").insert({ name: `Iso ${tag} ${stamp}`, slug: `iso-${tag}-${stamp}` }).select("id").single();
  if (oe) throw new Error(`org ${tag}: ${oe.message}`);
  created.orgs.push(org.id);
  const { error: me } = await admin.from("team_members").insert({ org_id: org.id, user_id: u.user.id, role: "owner", email });
  if (me) throw new Error(`member ${tag}: ${me.message}`);
  const { data: deal, error: de } = await admin.from("deals").insert({ org_id: org.id, name: `Deal ${tag} ${stamp}` }).select("id").single();
  if (de) throw new Error(`deal ${tag}: ${de.message}`);
  return { email, orgId: org.id, dealId: deal.id };
}

try {
  const A = await mkTenant("A");
  const B = await mkTenant("B");
  console.log(`\nSeeded: OrgA=${A.orgId} dealA=${A.dealId} | OrgB=${B.orgId} dealB=${B.dealId}\n`);

  // Sign in as A with the anon key -> RLS applies to everything A does.
  const aClient = createClient(url, anon, { auth: { persistSession: false } });
  const { error: sie } = await aClient.auth.signInWithPassword({ email: A.email, password: pass });
  if (sie) throw new Error("signin A: " + sie.message);

  // 1. A sees exactly its own deal
  const { data: aDeals } = await aClient.from("deals").select("id,org_id");
  check("A lists only its own deals", aDeals?.length === 1 && aDeals[0].id === A.dealId, `got ${aDeals?.length} rows`);

  // 2. A cannot read B's deal by id
  const { data: bDealAsA } = await aClient.from("deals").select("id").eq("id", B.dealId);
  check("A CANNOT read B's deal by id", (bDealAsA?.length ?? 0) === 0, `got ${bDealAsA?.length} rows`);

  // 3. A cannot read B's organization
  const { data: bOrgAsA } = await aClient.from("organizations").select("id").eq("id", B.orgId);
  check("A CANNOT read B's organization", (bOrgAsA?.length ?? 0) === 0, `got ${bOrgAsA?.length} rows`);

  // 4. A cannot read B's team_members
  const { data: bMembersAsA } = await aClient.from("team_members").select("id").eq("org_id", B.orgId);
  check("A CANNOT read B's team members", (bMembersAsA?.length ?? 0) === 0, `got ${bMembersAsA?.length} rows`);

  // 5. A cannot WRITE a deal into B's org (RLS WITH CHECK)
  const { error: writeErr } = await aClient.from("deals").insert({ org_id: B.orgId, name: "cross-tenant write" }).select("id");
  check("A CANNOT insert a deal into B's org", !!writeErr, writeErr ? writeErr.code : "insert SUCCEEDED (bad!)");

  // 6. A cannot UPDATE B's deal
  const { data: upd } = await aClient.from("deals").update({ name: "hijacked" }).eq("id", B.dealId).select("id");
  check("A CANNOT update B's deal", (upd?.length ?? 0) === 0, `${upd?.length ?? 0} rows updated`);

  // 7. jobs leak status (pre-fix this is EXPOSED to anon; after 0015 it should be blocked)
  const anonOnly = createClient(url, anon, { auth: { persistSession: false } });
  const { data: jobsAnon } = await anonOnly.from("jobs").select("id").limit(1);
  check("jobs NOT readable by anon (needs 0015 applied)", (jobsAnon?.length ?? 0) === 0, `anon read ${jobsAnon?.length ?? 0} job row(s)`);

  await aClient.auth.signOut();
} catch (e) {
  console.error("\nTEST ERROR:", e.message);
  fail_count++;
} finally {
  // Cleanup: deleting orgs cascades team_members + deals; then delete auth users.
  for (const id of created.orgs) await admin.from("organizations").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`\nCleaned up ${created.orgs.length} orgs + ${created.users.length} users.`);
  console.log(`\n==== ${pass_count} passed, ${fail_count} failed ====`);
}
