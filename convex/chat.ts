import { v } from "convex/values";
import { query, mutation, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.CONVEX_OPENAI_API_KEY,
});

export const getConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify user owns this conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) return [];

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

export const getMessagesInternal = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

export const createConversation = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("conversations", {
      userId,
      title: args.title,
    });
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user owns this conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Add user message
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
    });

    // Check if this is the first message and generate a title
    const messageCount = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    if (messageCount.length === 1) {
      // This is the first message, schedule title generation
      await ctx.scheduler.runAfter(0, internal.chat.generateTitle, {
        conversationId: args.conversationId,
        firstMessage: args.content,
      });
    }

    // Create placeholder for AI response
    const assistantMessageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: "",
      isStreaming: true,
    });

    // Schedule AI response
    await ctx.scheduler.runAfter(0, internal.chat.generateStreamingResponse, {
      conversationId: args.conversationId,
      assistantMessageId,
    });

    return assistantMessageId;
  },
});

export const generateStreamingResponse = internalAction({
  args: {
    conversationId: v.id("conversations"),
    assistantMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    // Get conversation history
    const messages = await ctx.runQuery(internal.chat.getMessagesInternal, {
      conversationId: args.conversationId,
    });

    // Filter out the streaming message and prepare for OpenAI
    const chatHistory = messages
      .filter((msg) => !msg.isStreaming)
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    try {
      // Get AI response with streaming
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: chatHistory,
        stream: true,
      });

      let fullContent = "";
      let chunkCount = 0;
      
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullContent += delta;
          chunkCount++;
          
          // Update every 3 chunks or every 15 characters, whichever comes first
          if (chunkCount % 3 === 0 || fullContent.length % 15 === 0) {
            await ctx.runMutation(internal.chat.updateStreamingMessage, {
              messageId: args.assistantMessageId,
              content: fullContent,
              isStreaming: true,
            });
          }
        }
      }

      // Mark streaming as complete
      await ctx.runMutation(internal.chat.updateStreamingMessage, {
        messageId: args.assistantMessageId,
        content: fullContent,
        isStreaming: false,
      });

    } catch (error) {
      console.error("Error generating AI response:", error);
      await ctx.runMutation(internal.chat.updateStreamingMessage, {
        messageId: args.assistantMessageId,
        content: "I'm sorry, I encountered an error while generating a response.",
        isStreaming: false,
      });
    }
  },
});

export const updateStreamingMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    isStreaming: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      content: args.content,
      isStreaming: args.isStreaming,
    });
  },
});

export const generateTitle = internalAction({
  args: {
    conversationId: v.id("conversations"),
    firstMessage: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content: "Generate a short, descriptive title (3-5 words) for a conversation based on the user's first message. The title should capture the main topic or intent. Respond with only the title, no quotes or extra text.",
          },
          {
            role: "user",
            content: args.firstMessage,
          },
        ],
        stream: false,
        max_tokens: 20,
      });

      const title = completion.choices[0]?.message?.content?.trim() || "New Chat";

      await ctx.runMutation(internal.chat.updateConversationTitle, {
        conversationId: args.conversationId,
        title,
      });
    } catch (error) {
      console.error("Error generating title:", error);
    }
  },
});

export const updateConversationTitle = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      title: args.title,
    });
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify user owns this conversation
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Delete all messages in the conversation
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the conversation
    await ctx.db.delete(args.conversationId);
  },
});
