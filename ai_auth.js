const { getAIResponse } = require("./aiService");
const { AIChat } = require("./models");

const chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;
    const user = req.user;

    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Message required",
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Message too long",
      });
    }

    const previousChats = await AIChat.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    let conversation = ` You are an ERP assistant. Reply according to user's role. Keep answers concise and useful. Role:${user.role} Name:${user.name} Conversation: `;

    previousChats.reverse().forEach((chat) => {
      conversation += ` User:${chat.userMessage} AI:${chat.aiReply} `;
    });

    conversation += ` User:${message} Assistant: `;

    const aiReply = await getAIResponse(conversation);

    await AIChat.create({
      userId: user._id,
      role: user.role,
      userMessage: message,
      aiReply,
    });

    res.status(200).json({
      success: true,
      reply: aiReply,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user chat
const getChatHistory = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const chats = await AIChat.find({
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      chats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { chatWithAI, getChatHistory };
