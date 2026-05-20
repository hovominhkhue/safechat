const mongoose = require("mongoose");
const ConversationMember = require("../models/ConversationMember");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

async function listMine(req, res) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const memberships = await ConversationMember.find({ userId }).lean();

    if (memberships.length === 0) {
      return res.status(200).json({ conversations: [] });
    }

    const roleByConvId = {};
    for (const m of memberships) {
      roleByConvId[m.conversationId.toString()] = m.role;
    }

    const convIds = memberships.map((m) => m.conversationId);

    const convs = await Conversation.find({ _id: { $in: convIds } })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    const conversations = convs.map((c) => ({
      id: c._id.toString(),
      type: c.type,
      name: c.title || null,
      channelTopic: c.channelTopic || null,
      lastMessageAt: c.lastMessageAt || null,
      lastMessagePreview: c.lastMessagePreview || null,
      messageCount: c.messageCount,
      myRole: roleByConvId[c._id.toString()],
    }));

    return res.status(200).json({ conversations });
  } catch (e) {
    console.error("LIST_CONVERSATIONS_FAILED:", e);
    return res.status(500).json({ error: "LIST_CONVERSATIONS_FAILED", message: e.message });
  }
}

async function createOrGetDm(req, res) {
  try {
    const { otherUserId } = req.body;

    if (!otherUserId || !mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "otherUserId est requis et doit être un ObjectId valide" });
    }

    const userAId = new mongoose.Types.ObjectId(req.user.userId);
    const userBId = new mongoose.Types.ObjectId(otherUserId);

    if (userAId.equals(userBId)) {
      return res.status(400).json({ error: "SELF_DM" });
    }

    const otherUser = await User.findById(userBId).lean();
    if (!otherUser) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const [a, b] = [String(userAId), String(userBId)].sort();
    const dmKey = `${a}_${b}`;

    const existing = await Conversation.findOne({ type: "DM", dmKey }).lean();

    if (existing) {
      return res.status(200).json({
        conversation: {
          id: existing._id.toString(),
          type: existing.type,
          dmKey: existing.dmKey,
          otherUser: { id: otherUser._id.toString(), username: otherUser.username },
          myRole: "MEMBER",
        },
      });
    }

    const conv = await Conversation.create({
      type: "DM",
      channelId: dmKey,
      dmKey,
      createdBy: userAId,
    });

    await ConversationMember.insertMany([
      { conversationId: conv._id, userId: userAId, role: "MEMBER" },
      { conversationId: conv._id, userId: userBId, role: "MEMBER" },
    ]);

    return res.status(201).json({
      conversation: {
        id: conv._id.toString(),
        type: conv.type,
        dmKey: conv.dmKey,
        otherUser: { id: otherUser._id.toString(), username: otherUser.username },
        myRole: "MEMBER",
      },
    });
  } catch (e) {
    console.error("CREATE_OR_GET_DM_FAILED:", e);
    return res.status(500).json({ error: "CREATE_OR_GET_DM_FAILED", message: e.message });
  }
}

async function createGroup(req, res) {
  try {
    const { name, memberIds } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "name est requis et doit être une string non vide" });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ error: "BAD_REQUEST", message: "memberIds doit être un tableau" });
    }

    for (const id of memberIds) {
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ error: "INVALID_MEMBER_ID", message: `${id} n'est pas un ObjectId valide` });
      }
    }

    const creatorId = new mongoose.Types.ObjectId(req.user.userId);

    // Dédupliquer : retirer le créateur s'il est dans memberIds
    const uniqueMemberIds = [...new Set(memberIds.map(String))]
      .filter((id) => id !== String(creatorId))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (uniqueMemberIds.length > 0) {
      const found = await User.find({ _id: { $in: uniqueMemberIds } }).lean();
      if (found.length !== uniqueMemberIds.length) {
        return res.status(404).json({ error: "USER_NOT_FOUND" });
      }
    }

    const channelId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const conv = await Conversation.create({
      type: "GROUP",
      channelId,
      title: name.trim(),
      createdBy: creatorId,
    });

    const memberDocs = [
      { conversationId: conv._id, userId: creatorId, role: "OWNER" },
      ...uniqueMemberIds.map((uid) => ({ conversationId: conv._id, userId: uid, role: "MEMBER" })),
    ];

    try {
      await ConversationMember.insertMany(memberDocs);
    } catch (insertErr) {
      // Cleanup best-effort pour éviter une conversation orpheline
      await Conversation.deleteOne({ _id: conv._id }).catch(() => {});
      throw insertErr;
    }

    const membersCount = memberDocs.length;

    return res.status(201).json({
      conversation: {
        id: conv._id.toString(),
        type: conv.type,
        name: conv.title,
        membersCount,
        myRole: "OWNER",
      },
    });
  } catch (e) {
    console.error("CREATE_GROUP_FAILED:", e);
    return res.status(500).json({ error: "CREATE_GROUP_FAILED", message: e.message });
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "INVALID_ID" });
    }

    const conv = await Conversation.findById(id).lean();
    if (!conv) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const members = await ConversationMember.find({ conversationId: conv._id })
      .populate("userId", "username")
      .lean();

    const myMembership = members.find(
      (m) => m.userId && m.userId._id.toString() === String(req.user.userId)
    );

    if (!myMembership) {
      return res.status(403).json({ error: "NOT_A_MEMBER" });
    }

    return res.status(200).json({
      conversation: {
        id: conv._id.toString(),
        type: conv.type,
        name: conv.title || null,
        channelTopic: conv.channelTopic || null,
        dmKey: conv.dmKey || null,
        createdBy: conv.createdBy.toString(),
        lastMessageAt: conv.lastMessageAt || null,
        lastMessagePreview: conv.lastMessagePreview || null,
        messageCount: conv.messageCount,
        createdAt: conv.createdAt,
        myRole: myMembership.role,
        members: members.map((m) => ({
          id: m.userId._id.toString(),
          username: m.userId.username,
          role: m.role,
        })),
      },
    });
  } catch (e) {
    console.error("GET_CONVERSATION_FAILED:", e);
    return res.status(500).json({ error: "GET_CONVERSATION_FAILED", message: e.message });
  }
}

async function addMember(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "INVALID_ID" });
    }
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }

    const conv = await Conversation.findById(id).lean();
    if (!conv) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const myMembership = await ConversationMember.findOne({
      conversationId: conv._id,
      userId: new mongoose.Types.ObjectId(req.user.userId),
    }).lean();

    if (!myMembership) {
      return res.status(403).json({ error: "NOT_A_MEMBER" });
    }
    if (myMembership.role !== "OWNER") {
      return res.status(403).json({ error: "NOT_OWNER" });
    }

    if (conv.type !== "GROUP") {
      return res.status(400).json({ error: "NOT_A_GROUP" });
    }

    const targetId = new mongoose.Types.ObjectId(userId);

    const targetUser = await User.findById(targetId).lean();
    if (!targetUser) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const existing = await ConversationMember.findOne({
      conversationId: conv._id,
      userId: targetId,
    }).lean();
    if (existing) {
      return res.status(409).json({ error: "ALREADY_MEMBER" });
    }

    const member = await ConversationMember.create({
      conversationId: conv._id,
      userId: targetId,
      role: "MEMBER",
    });

    return res.status(201).json({
      ok: true,
      member: {
        id: member._id.toString(),
        userId: targetUser._id.toString(),
        username: targetUser.username,
        role: member.role,
      },
    });
  } catch (e) {
    console.error("ADD_MEMBER_FAILED:", e);
    return res.status(500).json({ error: "ADD_MEMBER_FAILED", message: e.message });
  }
}

async function removeMember(req, res) {
  try {
    const { id, userId } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "INVALID_ID" });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: "INVALID_USER_ID" });
    }

    const conv = await Conversation.findById(id).lean();
    if (!conv) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const myMembership = await ConversationMember.findOne({
      conversationId: conv._id,
      userId: new mongoose.Types.ObjectId(req.user.userId),
    }).lean();

    if (!myMembership || myMembership.role !== "OWNER") {
      return res.status(403).json({ error: "NOT_OWNER" });
    }

    if (conv.type !== "GROUP") {
      return res.status(400).json({ error: "NOT_A_GROUP" });
    }

    const targetId = new mongoose.Types.ObjectId(userId);

    const targetMembership = await ConversationMember.findOne({
      conversationId: conv._id,
      userId: targetId,
    }).lean();

    if (!targetMembership) {
      return res.status(404).json({ error: "MEMBER_NOT_FOUND" });
    }
    if (targetMembership.role === "OWNER") {
      return res.status(400).json({ error: "CANNOT_REMOVE_OWNER" });
    }

    await ConversationMember.deleteOne({ _id: targetMembership._id });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("REMOVE_MEMBER_FAILED:", e);
    return res.status(500).json({ error: "REMOVE_MEMBER_FAILED", message: e.message });
  }
}

module.exports = { listMine, createOrGetDm, createGroup, getById, addMember, removeMember };
