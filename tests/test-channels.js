// Integration smoke test — Channels
// Exit 0 = all assertions passed. Exit 1 = at least one failure.

const BASE = "http://localhost:3001";
const OTP = process.env.OTP_FAKE_CODE || "123456";

const PHONE_A = `06${Date.now().toString().slice(-8)}`;
const PHONE_B = `07${Date.now().toString().slice(-8)}`;

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

  console.log("\n[2] GET /channels");
  const listChannels = await request("GET", "/channels", null, userA.token);

  assert("status 200", listChannels.status === 200, `got ${listChannels.status}`);
  assert(
    "channels array exists",
    Array.isArray(listChannels.body.channels),
    JSON.stringify(listChannels.body)
  );
  assert(
    "at least one channel exists",
    listChannels.body.channels.length > 0,
    JSON.stringify(listChannels.body.channels)
  );

  const firstChannel = listChannels.body.channels[0];
  const topic = firstChannel?.topic;

  assert("channel topic present", typeof topic === "string", JSON.stringify(firstChannel));

  console.log("\n[3] POST /channels/:topic/join");
  const joinChannel = await request(
    "POST",
    `/channels/${topic}/join`,
    null,
    userB.token
  );

  assert(
    "status 200 or 201",
    [200, 201].includes(joinChannel.status),
    `got ${joinChannel.status} ${JSON.stringify(joinChannel.body)}`
  );

  assert(
    "conversationId returned after join",
    typeof joinChannel.body.channel?.conversationId === "string",
    JSON.stringify(joinChannel.body)
  );

  console.log("\n[4] DELETE /channels/:topic/leave");
  const leaveChannel = await request(
    "DELETE",
    `/channels/${topic}/leave`,
    null,
    userB.token
  );

  assert(
    "status 200",
    leaveChannel.status === 200,
    `got ${leaveChannel.status} ${JSON.stringify(leaveChannel.body)}`
  );

  console.log(`\n── Result: ${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`} ──\n`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
