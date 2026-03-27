import { beforeEach, describe, expect, it, vi } from 'vitest';

const responseStreamOn = vi.fn();
const turnCompletedOn = vi.fn();
const listChangedOn = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      responseStream: {
        on: responseStreamOn,
      },
      turnCompleted: {
        on: turnCompletedOn,
      },
      listChanged: {
        on: listChangedOn,
      },
    },
  },
}));

describe('ConversationLiveStateService', () => {
  beforeEach(() => {
    vi.resetModules();
    responseStreamOn.mockReset();
    responseStreamOn.mockReturnValue(() => {});
    turnCompletedOn.mockReset();
    turnCompletedOn.mockReturnValue(() => {});
    listChangedOn.mockReset();
    listChangedOn.mockReturnValue(() => {});
  });

  it('tracks generating state using the same stream semantics as AionUI', async () => {
    const { conversationLiveStateService } = await import('../../../src/process/services/ConversationLiveStateService');

    const handleResponseStream = responseStreamOn.mock.calls[0]?.[0] as
      | ((message: { conversation_id: string; type: string; data: unknown; msg_id: string }) => void)
      | undefined;
    const handleTurnCompleted = turnCompletedOn.mock.calls[0]?.[0] as
      | ((event: { sessionId: string }) => void)
      | undefined;

    handleResponseStream?.({
      conversation_id: 'session-1',
      type: 'request_trace',
      data: {},
      msg_id: 'trace-1',
    });
    expect(conversationLiveStateService.isGeneratingLikeUi('session-1')).toBe(false);

    handleResponseStream?.({
      conversation_id: 'session-1',
      type: 'content',
      data: 'partial',
      msg_id: 'assistant-1',
    });
    expect(conversationLiveStateService.isGeneratingLikeUi('session-1')).toBe(true);

    handleResponseStream?.({
      conversation_id: 'session-1',
      type: 'finish',
      data: null,
      msg_id: 'assistant-1',
    });
    expect(conversationLiveStateService.isGeneratingLikeUi('session-1')).toBe(false);

    handleResponseStream?.({
      conversation_id: 'session-1',
      type: 'content',
      data: 'partial',
      msg_id: 'assistant-2',
    });
    expect(conversationLiveStateService.isGeneratingLikeUi('session-1')).toBe(true);

    handleTurnCompleted?.({
      sessionId: 'session-1',
    });
    expect(conversationLiveStateService.isGeneratingLikeUi('session-1')).toBe(false);
  });

  it('forgets deleted conversations', async () => {
    const { conversationLiveStateService } = await import('../../../src/process/services/ConversationLiveStateService');

    const handleResponseStream = responseStreamOn.mock.calls[0]?.[0] as
      | ((message: { conversation_id: string; type: string; data: unknown; msg_id: string }) => void)
      | undefined;
    const handleListChanged = listChangedOn.mock.calls[0]?.[0] as
      | ((event: { action: string; conversationId: string }) => void)
      | undefined;

    handleResponseStream?.({
      conversation_id: 'session-2',
      type: 'content',
      data: 'partial',
      msg_id: 'assistant-1',
    });
    expect(conversationLiveStateService.isGeneratingLikeUi('session-2')).toBe(true);

    handleListChanged?.({
      action: 'deleted',
      conversationId: 'session-2',
    });
    expect(conversationLiveStateService.getSessionState('session-2')).toBeUndefined();
  });
});
