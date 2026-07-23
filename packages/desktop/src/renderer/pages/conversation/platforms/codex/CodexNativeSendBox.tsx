import { ipcBridge } from '@/common';
import { parseError } from '@/common/utils';
import SendBox from '@/renderer/components/chat/SendBox';
import ThoughtDisplay from '@/renderer/components/chat/ThoughtDisplay';
import { useAutoTitle } from '@/renderer/hooks/chat/useAutoTitle';
import { useAddOrUpdateMessage } from '@/renderer/pages/conversation/Messages/hooks';
import type { UseAcpMessageReturn } from '@/renderer/pages/conversation/platforms/acp/useAcpMessage';
import { useConversationRuntimeView } from '@/renderer/pages/conversation/runtime/useConversationRuntimeView';
import { getChatSurfaceWidthClass } from '@/renderer/pages/conversation/utils/chatSurfaceWidth';
import { emitter } from '@/renderer/utils/emitter';
import { Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { codexNativeInitialMessageKey } from './storage';

type InitialMessage = {
  input?: string;
  files?: string[];
};

const CodexNativeSendBox: React.FC<{
  conversation_id: string;
  messageState: UseAcpMessageReturn;
}> = ({ conversation_id, messageState }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const sendingRef = useRef(false);
  const runtimeView = useConversationRuntimeView(conversation_id);
  const addOrUpdateMessage = useAddOrUpdateMessage();
  const { checkAndUpdateTitle } = useAutoTitle();

  const send = useCallback(
    async (input: string, files: string[] = []) => {
      const trimmed = input.trim();
      if (!trimmed || sendingRef.current) return;
      sendingRef.current = true;
      runtimeView.markSendStarted();
      messageState.setAiProcessing(true);
      try {
        void checkAndUpdateTitle(conversation_id, trimmed);
        const result = await ipcBridge.acpConversation.sendMessage.invoke({
          input: trimmed,
          conversation_id,
          files,
        });
        runtimeView.markSendAccepted(result.turn_id, result.runtime, result.msg_id);
        addOrUpdateMessage(
          {
            id: result.msg_id,
            msg_id: result.msg_id,
            conversation_id,
            type: 'text',
            position: 'right',
            status: 'finish',
            created_at: Date.now(),
            content: { content: trimmed },
          },
          true
        );
        setContent('');
        emitter.emit('chat.history.refresh');
      } catch (error) {
        const reason = parseError(error) || t('common.unknownError');
        runtimeView.markSendFailed(reason);
        messageState.setAiProcessing(false);
        Message.error(reason);
      } finally {
        sendingRef.current = false;
      }
    },
    [addOrUpdateMessage, checkAndUpdateTitle, conversation_id, messageState, runtimeView, t]
  );

  useEffect(() => {
    const key = codexNativeInitialMessageKey(conversation_id);
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    try {
      const initial = JSON.parse(raw) as InitialMessage;
      if (initial.input) void send(initial.input, initial.files);
    } catch (error) {
      console.warn('[CodexNativeSendBox] invalid initial message', error);
    }
  }, [conversation_id, send]);

  const stop = useCallback(async () => {
    const turnId = runtimeView.activeTurnId;
    if (!turnId) {
      messageState.resetState();
      return;
    }
    runtimeView.markStopRequested(turnId);
    try {
      const result = await ipcBridge.conversation.stop.invoke({ conversation_id, turn_id: turnId });
      runtimeView.markStopAcknowledged(turnId, result.runtime);
    } catch (error) {
      console.warn('[CodexNativeSendBox] stop request failed', error);
      runtimeView.resetLocalGate('stop_failed');
    } finally {
      messageState.resetState();
    }
  }, [conversation_id, messageState, runtimeView]);

  const loading = runtimeView.isProcessing || messageState.aiProcessing;
  return (
    <div className={`${getChatSurfaceWidthClass(false)} flex flex-col mt-auto mb-16px`}>
      <ThoughtDisplay running={messageState.aiProcessing && !messageState.hasThinkingMessage} onStop={stop} />
      <SendBox
        value={content}
        onChange={setContent}
        onSend={async (message) => send(message)}
        onStop={stop}
        loading={loading}
        disabled={false}
        placeholder={t('acp.sendbox.placeholder', { backend: 'GPT Codex' })}
        allowSendWhileLoading
        defaultMultiLine
        lockMultiLine
        className='z-10'
      />
    </div>
  );
};

export default CodexNativeSendBox;
