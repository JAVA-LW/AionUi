import { ConversationProvider } from '@/renderer/hooks/context/ConversationContext';
import { CHAT_SURFACE_CONTAINER_CLASS } from '@/renderer/pages/conversation/utils/chatSurfaceWidth';
import FlexFullContainer from '@renderer/components/layout/FlexFullContainer';
import MessageList from '@renderer/pages/conversation/Messages/MessageList';
import { ConversationArtifactProvider } from '@renderer/pages/conversation/Messages/artifacts';
import {
  MessageListLoadingProvider,
  MessageListProvider,
  MessagePaginationProvider,
  useMessageLstCache,
} from '@renderer/pages/conversation/Messages/hooks';
import { usePendingConfirmationsRecovery } from '@renderer/pages/conversation/Messages/usePendingConfirmationsRecovery';
import HOC from '@renderer/utils/ui/HOC';
import React from 'react';
import { useAcpMessage } from '../acp/useAcpMessage';
import CodexNativeSendBox from './CodexNativeSendBox';

const CodexNativeChat: React.FC<{
  conversation_id: string;
  workspace: string;
  hideSendBox?: boolean;
  emptySlot?: React.ReactNode;
}> = ({ conversation_id, workspace, hideSendBox, emptySlot }) => {
  useMessageLstCache(conversation_id);
  usePendingConfirmationsRecovery(conversation_id);
  const messageState = useAcpMessage(conversation_id, { skipWarmup: true });

  return (
    <ConversationProvider value={{ conversation_id, workspace, type: 'codex-app-server', hideSendBox }}>
      <ConversationArtifactProvider conversation_id={conversation_id}>
        <div className={`${CHAT_SURFACE_CONTAINER_CLASS} flex-1 flex flex-col px-20px min-h-0`}>
          <FlexFullContainer>
            <MessageList className='flex-1' emptySlot={emptySlot} />
          </FlexFullContainer>
          {!hideSendBox && <CodexNativeSendBox conversation_id={conversation_id} messageState={messageState} />}
        </div>
      </ConversationArtifactProvider>
    </ConversationProvider>
  );
};

export default HOC.Wrapper(MessageListProvider, MessageListLoadingProvider, MessagePaginationProvider)(CodexNativeChat);
