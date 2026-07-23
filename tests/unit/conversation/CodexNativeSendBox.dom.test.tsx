import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcBridge } from '@/common';
import CodexNativeSendBox from '@/renderer/pages/conversation/platforms/codex/CodexNativeSendBox';
import { codexNativeInitialMessageKey } from '@/renderer/pages/conversation/platforms/codex/storage';

const addOrUpdateMessage = vi.fn();
const checkAndUpdateTitle = vi.fn();
const markSendStarted = vi.fn();
const markSendAccepted = vi.fn();
const runtimeView = {
  isProcessing: true,
  activeTurnId: 'turn-active',
  markSendStarted,
  markSendAccepted,
  markSendFailed: vi.fn(),
  markStopRequested: vi.fn(),
  markStopAcknowledged: vi.fn(),
  resetLocalGate: vi.fn(),
};

vi.mock('@/common', () => ({
  ipcBridge: {
    acpConversation: { sendMessage: { invoke: vi.fn() } },
    conversation: { stop: { invoke: vi.fn() } },
  },
}));

vi.mock('@/common/utils', () => ({ parseError: (error: unknown) => String(error) }));

vi.mock('@/renderer/components/chat/SendBox', () => ({
  default: (props: {
    onSend: (message: string) => Promise<void>;
    allowSendWhileLoading?: boolean;
    loading?: boolean;
  }) => (
    <button
      data-testid='native-send'
      data-allow-while-loading={String(props.allowSendWhileLoading)}
      data-loading={String(props.loading)}
      onClick={() => void props.onSend('follow up now')}
    >
      send
    </button>
  ),
}));

vi.mock('@/renderer/components/chat/ThoughtDisplay', () => ({ default: () => null }));
vi.mock('@/renderer/hooks/chat/useAutoTitle', () => ({ useAutoTitle: () => ({ checkAndUpdateTitle }) }));
vi.mock('@/renderer/pages/conversation/Messages/hooks', () => ({ useAddOrUpdateMessage: () => addOrUpdateMessage }));
vi.mock('@/renderer/pages/conversation/runtime/useConversationRuntimeView', () => ({
  useConversationRuntimeView: () => runtimeView,
}));
vi.mock('@/renderer/pages/conversation/utils/chatSurfaceWidth', () => ({
  getChatSurfaceWidthClass: () => 'chat-width',
}));
vi.mock('@/renderer/utils/emitter', () => ({ emitter: { emit: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@arco-design/web-react', () => ({ Message: { error: vi.fn() } }));

const sendMessage = vi.mocked(ipcBridge.acpConversation.sendMessage.invoke);
const messageState = {
  aiProcessing: true,
  hasThinkingMessage: false,
  setAiProcessing: vi.fn(),
  resetState: vi.fn(),
};

describe('CodexNativeSendBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    sendMessage.mockResolvedValue({
      msg_id: 'msg-1',
      turn_id: 'turn-active',
      runtime: { state: 'running' },
    } as Awaited<ReturnType<typeof sendMessage>>);
  });

  it('sends directly while a turn is already running', async () => {
    render(<CodexNativeSendBox conversation_id='conversation-1' messageState={messageState as never} />);

    const send = screen.getByTestId('native-send');
    expect(send).toHaveAttribute('data-loading', 'true');
    expect(send).toHaveAttribute('data-allow-while-loading', 'true');
    fireEvent.click(send);

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        input: 'follow up now',
        conversation_id: 'conversation-1',
        files: [],
      })
    );
    expect(markSendStarted).toHaveBeenCalledOnce();
    expect(markSendAccepted).toHaveBeenCalledWith('turn-active', { state: 'running' }, 'msg-1');
  });

  it('consumes the native initial message key after navigation', async () => {
    sessionStorage.setItem(
      codexNativeInitialMessageKey('conversation-2'),
      JSON.stringify({ input: 'start native task', files: ['/tmp/spec.md'] })
    );

    render(<CodexNativeSendBox conversation_id='conversation-2' messageState={messageState as never} />);

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        input: 'start native task',
        conversation_id: 'conversation-2',
        files: ['/tmp/spec.md'],
      })
    );
    expect(sessionStorage.getItem(codexNativeInitialMessageKey('conversation-2'))).toBeNull();
  });
});
