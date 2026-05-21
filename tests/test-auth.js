// Integration smoke test — uses Node 20 built-in fetch, no external deps.
// Exit 0 = all assertions passed. Exit 1 = at least one failure.

const BASE = "http://localhost:3001";
const PHONE = `06${Date.now().toString().slice(-8)}`;
const OTP = process.env.OTP_FAKE_CODE || "123456";

let failures = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let json = {};
  try {
    json = await res.json();
  } catch {}

  return { status: res.status, body: json };
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let json = {};
  try {
    json = await res.json();
  } catch {}

  return { status: res.status, body: json };
}

async function run() {
  console.log("\n── Auth smoke test ──");

  // 1. request-otp
  console.log("\n[1] POST /auth/request-otp");
  const r1 = await post("/auth/request-otp", { phone: PHONE });
  assert("status 200", r1.status === 200, `got ${r1.status}`);
  assert("body.ok === true", r1.body.ok === true, JSON.stringify(r1.body));

  // 2. verify-otp
  console.log("\n[2] POST /auth/verify-otp");
  const r2 = await post("/auth/verify-otp", { phone: PHONE, otp: OTP });
  assert("status 200", r2.status === 200, `got ${r2.status}`);
  assert("body.token present", typeof r2.body.token === "string" && r2.body.token.length > 0);
  assert("body.user.phone matches", r2.body.user?.phone === PHONE);

  const token = r2.body.token;

  // 3. /auth/me
  console.log("\n[3] GET /auth/me");
  const r3 = await get("/auth/me", token);
  assert("status 200", r3.status === 200, `got ${r3.status}`);
  assert("body.user.phone matches", r3.body.user?.phone === PHONE);

  // 4. /auth/me — invalid token
  console.log("\n[4] GET /auth/me (invalid token)");
  const r4 = await get("/auth/me", "not-a-valid-token");
  assert("status 401", r4.status === 401, `got ${r4.status}`);

  console.log(`\n── Result: ${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`} ──\n`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
