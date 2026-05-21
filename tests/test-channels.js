// Integration smoke test — Channels
// Exit 0 = all assertions passed. Exit 1 = at least one failure.

const BASE = "http://localhost:3001";
const OTP = process.env.OTP_FAKE_CODE || "123456";

const PHONE_A = `06${Date.now().toString().slice(-8)}`;
const PHONE_B = `07${Date.now().toString().slice(-8)}`;
const CHANNEL_NAME = `test-channel-${Date.now()}`;

let failures = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

async function request(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json = {};
  try {
    json = await res.json();
  } catch {}

  return { status: res.status, body: json };
}

async function createUser(phone) {
  await request("POST", "/auth/request-otp", { phone });

  const verify = await request("POST", "/auth/verify-otp", {
    phone,
    otp: OTP,
  });

  return {
    token: verify.body.token,
    user: verify.body.user,
  };
}

async function run() {
  console.log("\n── Channel smoke test ──");

  console.log("\n[1] Create two users");
  const userA = await createUser(PHONE_A);
  const userB = await createUser(PHONE_B);

  assert("user A token present", typeof userA.token === "string");
  assert("user B token present", typeof userB.token === "string");

  console.log("\n[2] POST /channels");
  const createChannel = await request(
    "POST",
    "/channels",
    { name: CHANNEL_NAME },
    userA.token
  );

  assert("status 201", createChannel.status === 201, `got ${createChannel.status}`);
  assert("channel name matches", createChannel.body.name === CHANNEL_NAME);

  const channelId = createChannel.body._id || createChannel.body.id;
  assert("channel id present", typeof channelId === "string");

  console.log("\n[3] GET /channels");
  const listChannels = await request("GET", "/channels", null, userA.token);

  assert("status 200", listChannels.status === 200, `got ${listChannels.status}`);
  assert("body is array", Array.isArray(listChannels.body));

  console.log("\n[4] POST /channels/:id/join");
  const joinChannel = await request(
    "POST",
    `/channels/${channelId}/join`,
    null,
    userB.token
  );

  assert("status 200 or 204", [200, 204].includes(joinChannel.status), `got ${joinChannel.status}`);

  console.log("\n[5] GET /channels/:id");
  const getChannel = await request("GET", `/channels/${channelId}`, null, userB.token);

  assert("status 200", getChannel.status === 200, `got ${getChannel.status}`);
  assert("channel id matches", (getChannel.body._id || getChannel.body.id) === channelId);

  console.log(`\n── Result: ${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`} ──\n`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
