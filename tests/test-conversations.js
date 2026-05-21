// Integration smoke test — Conversations / DM
// Exit 0 = all assertions passed. Exit 1 = at least one failure.

const BASE = "http://localhost:3001";
const OTP = process.env.OTP_FAKE_CODE || "123456";

const PHONE_A = `06${Date.now().toString().slice(-8)}`;
const PHONE_B = `07${Date.now().toString().slice(-8)}`;

let failures = 0;

function assert(label, condition, detail = "") {
  if (condition) console.log(`  ✅ ${label}`);
  else {
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
  console.log("\n── Conversations smoke test ──");

  console.log("\n[1] Create two users");
  const userA = await createUser(PHONE_A);
  const userB = await createUser(PHONE_B);

  assert("user A token present", typeof userA.token === "string");
  assert("user B token present", typeof userB.token === "string");

  const userBId = userB.user?._id || userB.user?.id;
  assert("user B id present", typeof userBId === "string");

  console.log("\n[2] POST /conversations/dm");
  const createConversation = await request(
    "POST",
    "/conversations/dm",
    { otherUserId: userBId },
    userA.token
  );

  assert(
    "status 201 or 200",
    [200, 201].includes(createConversation.status),
    `got ${createConversation.status} ${JSON.stringify(createConversation.body)}`
  );

  const conversationId =
    createConversation.body.conversation?._id ||
    createConversation.body.conversation?.id ||
    createConversation.body._id ||
    createConversation.body.id;

  assert("conversation id present", typeof conversationId === "string", JSON.stringify(createConversation.body));

  console.log("\n[3] GET /conversations");
  const listConversations = await request("GET", "/conversations", null, userA.token);

  assert("status 200", listConversations.status === 200, `got ${listConversations.status}`);
  assert("body is array or contains conversations array",
    Array.isArray(listConversations.body) || Array.isArray(listConversations.body.conversations),
    JSON.stringify(listConversations.body)
  );

  console.log("\n[4] GET /conversations/:id");
  const getConversation = await request(
    "GET",
    `/conversations/${conversationId}`,
    null,
    userA.token
  );

  assert("status 200", getConversation.status === 200, `got ${getConversation.status}`);

  const returnedConversationId =
    getConversation.body._id ||
    getConversation.body.id ||
    getConversation.body.conversation?._id ||
    getConversation.body.conversation?.id;

  assert("conversation id matches", returnedConversationId === conversationId);

  console.log("\n[5] GET /conversations/:id with invalid token");
  const invalidToken = await request(
    "GET",
    `/conversations/${conversationId}`,
    null,
    "invalid-token"
  );

  assert("status 401", invalidToken.status === 401, `got ${invalidToken.status}`);

  console.log(`\n── Result: ${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`} ──\n`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
