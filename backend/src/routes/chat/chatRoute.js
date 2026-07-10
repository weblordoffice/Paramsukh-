import express from 'express';

import {
  clearConversation,
  getChatHealth,
  getConversationDetail,
  getMemory,
  listConversations,
  removeAllConversations,
  removeAllMemory,
  removeConversation,
  removeMemoryItem,
  renameConversation,
  sendChatMessage,
  streamMessage,
} from '../../controller/chat/chat.controller.js';
import { protectedRoutes } from '../../middleware/protectedRoutes.js';

const router = express.Router();

router.get('/health', getChatHealth);
router.post('/message', protectedRoutes, sendChatMessage);
router.post('/stream', protectedRoutes, streamMessage);
router.get('/conversations', protectedRoutes, listConversations);
router.get('/conversations/:conversationId', protectedRoutes, getConversationDetail);
router.patch('/conversations/:conversationId', protectedRoutes, renameConversation);
router.delete('/conversations/:conversationId', protectedRoutes, removeConversation);
router.post('/conversations/:conversationId/clear', protectedRoutes, clearConversation);
router.post('/conversations/clear-all', protectedRoutes, removeAllConversations);
router.get('/memory', protectedRoutes, getMemory);
router.delete('/memory/:memoryId', protectedRoutes, removeMemoryItem);
router.post('/memory/clear', protectedRoutes, removeAllMemory);

export default router;
