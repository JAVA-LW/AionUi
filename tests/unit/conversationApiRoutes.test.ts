/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';

type MinimalConversation = {
  id: string;
  name: string;
  type: 'gemini' | 'acp' | 'codex';
  source: string;
  status: 'pending' | 'running' | 'finished';
  createTime: number;
  modifyTime: number;
  extra: Record<string, unknown>;
  model?: {
    id: string;
    platform: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    useModel: string;
  };
};

vi.mock('../../src/webserver/middleware/apiAuthMiddleware', () => ({
  validateApiToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../src/webserver/middleware/security', () => ({
  apiRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('@process/services/conversationService', () => ({
  ConversationService: {},
}));

vi.mock('@process/WorkerManage', () => ({
  default: {
    getTaskById: vi.fn(() => undefined),
  },
}));

vi.mock('@process/database', () => ({
  getDatabase: vi.fn(() => ({
    getUserConversations: vi.fn(() => ({ data: [] })),
  })),
}));

vi.mock('@process/services/cron/CronBusyGuard', () => ({
  cronBusyGuard: {
    isProcessing: vi.fn(() => false),
  },
}));

vi.mock('@process/services/ConversationTurnCompletionService', () => ({
  getConversationStatusSnapshot: vi.fn(),
  formatStatusLastMessage: vi.fn((message) =>
    message
      ? {
          id: message.id,
          type: message.type,
          content: message.content,
          status: message.status ?? null,
          createdAt: message.createdAt ?? 0,
        }
      : undefined
  ),
}));

vi.mock('@/common', () => ({
  ipcBridge: {},
}));

vi.mock('@/common/utils', () => ({
  uuid: vi.fn(() => 'uuid-1'),
}));

vi.mock('@/common/utils/conversationTitle', () => ({
  buildConversationTitleFromMessage: vi.fn(() => 'title'),
}));

describe('conversationApiRoutes helpers', () => {
  it('recognizes active snapshots from runtime and non-stopped states', async () => {
    const { isConversationStatusActive } = await import('../../src/webserver/routes/conversationApiRoutes');

    expect(
      isConversationStatusActive({
        status: 'finished',
        state: 'ai_waiting_input',
        runtime: {
          hasTask: true,
          taskStatus: 'finished',
          isProcessing: false,
          pendingConfirmations: 0,
        },
      })
    ).toBe(false);

    expect(
      isConversationStatusActive({
        status: 'running',
        state: 'ai_generating',
        runtime: {
          hasTask: true,
          taskStatus: 'running',
          isProcessing: true,
          pendingConfirmations: 0,
        },
      })
    ).toBe(true);

    expect(
      isConversationStatusActive({
        status: 'finished',
        state: 'stopped',
        runtime: {
          hasTask: false,
          taskStatus: 'finished',
          isProcessing: false,
          pendingConfirmations: 0,
        },
      })
    ).toBe(false);
  });

  it('builds a sorted generating conversation status list by default', async () => {
    const { buildConversationStatusList } = await import('../../src/webserver/routes/conversationApiRoutes');

    const conversations: MinimalConversation[] = [
      {
        id: 'conv-stopped',
        name: 'Stopped',
        type: 'codex',
        source: 'api',
        status: 'finished',
        createTime: 10,
        modifyTime: 10,
        extra: {},
      },
      {
        id: 'conv-waiting',
        name: 'Waiting',
        type: 'gemini',
        source: 'api',
        status: 'finished',
        createTime: 20,
        modifyTime: 20,
        extra: { workspace: 'E:/workspace' },
        model: {
          id: 'model-1',
          platform: 'openai',
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '***',
          useModel: 'gpt-4o-mini',
        },
      },
      {
        id: 'conv-running',
        name: 'Running',
        type: 'acp',
        source: 'api',
        status: 'running',
        createTime: 30,
        modifyTime: 30,
        extra: { backend: 'codex' },
      },
    ];

    const getSnapshot = vi.fn((sessionId: string) => {
      if (sessionId === 'conv-stopped') {
        return {
          sessionId,
          conversation: conversations[0],
          status: 'finished',
          state: 'stopped',
          detail: 'Conversation is stopped',
          canSendMessage: true,
          runtime: {
            hasTask: false,
            isProcessing: false,
            pendingConfirmations: 0,
            dbStatus: 'finished',
          },
          lastMessage: null,
        };
      }

      if (sessionId === 'conv-waiting') {
        return {
          sessionId,
          conversation: conversations[1],
          status: 'finished',
          state: 'ai_waiting_input',
          detail: 'AI is waiting for input',
          canSendMessage: true,
          runtime: {
            hasTask: true,
            isProcessing: false,
            pendingConfirmations: 0,
            dbStatus: 'finished',
          },
          lastMessage: {
            id: 'msg-1',
            type: 'text',
            content: { content: 'done' },
            createdAt: 100,
          },
        };
      }

      return {
        sessionId,
        conversation: conversations[2],
        status: 'running',
        state: 'ai_generating',
        detail: 'AI is generating response',
        canSendMessage: false,
        runtime: {
          hasTask: true,
          isProcessing: true,
          pendingConfirmations: 0,
          dbStatus: 'running',
        },
        lastMessage: {
          id: 'msg-2',
          type: 'text',
          content: { content: 'working' },
          createdAt: 200,
        },
      };
    });

    const result = buildConversationStatusList(conversations as never, undefined, getSnapshot);

    expect(result).toHaveLength(1);
    expect(result.map((item) => item.sessionId)).toEqual(['conv-running']);
    expect(result[0]).toEqual(
      expect.objectContaining({
        sessionId: 'conv-running',
        cli: 'codex',
        status: 'running',
        state: 'ai_generating',
        updatedAt: 30,
      })
    );
  });

  it('supports scope and field filters for status list queries', async () => {
    const { buildConversationStatusList } = await import('../../src/webserver/routes/conversationApiRoutes');

    const conversations: MinimalConversation[] = [
      {
        id: 'conv-active',
        name: 'Active',
        type: 'gemini',
        source: 'api',
        status: 'finished',
        createTime: 10,
        modifyTime: 10,
        extra: { workspace: 'E:/workspace' },
        model: {
          id: 'model-1',
          platform: 'openai',
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '***',
          useModel: 'gpt-4o-mini',
        },
      },
      {
        id: 'conv-running',
        name: 'Running',
        type: 'acp',
        source: 'api',
        status: 'running',
        createTime: 30,
        modifyTime: 30,
        extra: { backend: 'codex' },
      },
      {
        id: 'conv-other-source',
        name: 'Other Source',
        type: 'codex',
        source: 'aionui',
        status: 'running',
        createTime: 40,
        modifyTime: 40,
        extra: {},
      },
    ];

    const getSnapshot = vi.fn((sessionId: string) => {
      if (sessionId === 'conv-active') {
        return {
          sessionId,
          conversation: conversations[0],
          status: 'finished',
          state: 'ai_waiting_input',
          detail: 'AI is waiting for input',
          canSendMessage: true,
          runtime: {
            hasTask: true,
            isProcessing: false,
            pendingConfirmations: 0,
            dbStatus: 'finished',
          },
          lastMessage: {
            id: 'msg-1',
            type: 'text',
            content: { content: 'done' },
            createdAt: 100,
          },
        };
      }

      if (sessionId === 'conv-running') {
        return {
          sessionId,
          conversation: conversations[1],
          status: 'running',
          state: 'ai_generating',
          detail: 'AI is generating response',
          canSendMessage: false,
          runtime: {
            hasTask: true,
            isProcessing: true,
            pendingConfirmations: 0,
            dbStatus: 'running',
          },
          lastMessage: {
            id: 'msg-2',
            type: 'text',
            content: { content: 'working' },
            createdAt: 200,
          },
        };
      }

      return {
        sessionId,
        conversation: conversations[2],
        status: 'running',
        state: 'ai_waiting_confirmation',
        detail: 'Waiting for tool confirmation',
        canSendMessage: false,
        runtime: {
          hasTask: true,
          isProcessing: false,
          pendingConfirmations: 1,
          dbStatus: 'running',
        },
        lastMessage: {
          id: 'msg-3',
          type: 'text',
          content: { content: 'confirm' },
          createdAt: 300,
        },
      };
    });

    const activeOnly = buildConversationStatusList(conversations as never, { scope: 'active' }, getSnapshot);
    expect(activeOnly.map((item) => item.sessionId)).toEqual(['conv-other-source', 'conv-running']);

    const apiGenerating = buildConversationStatusList(
      conversations as never,
      {
        scope: 'generating',
        source: ['api'],
        canSendMessage: false,
        type: ['acp'],
      },
      getSnapshot
    );

    expect(apiGenerating).toHaveLength(1);
    expect(apiGenerating[0]).toEqual(
      expect.objectContaining({
        sessionId: 'conv-running',
        cli: 'codex',
        source: 'api',
        type: 'acp',
        canSendMessage: false,
      })
    );

    const cliFiltered = buildConversationStatusList(
      conversations as never,
      {
        scope: 'active',
        cli: ['codex'],
      },
      getSnapshot
    );

    expect(cliFiltered.map((item) => item.sessionId)).toEqual(['conv-running']);
  });
});
