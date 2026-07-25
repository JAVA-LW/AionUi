import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { Button, Drawer, Empty, Spin, Tag } from '@arco-design/web-react';
import { Robot, Right } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import CodexNativeChat from './CodexNativeChat';

type CodexConversation = Extract<TChatConversation, { type: 'codex-app-server' }>;
const DRAWER_WIDTH_STORAGE_KEY = 'codex-subagent-drawer-width';
const DEFAULT_DRAWER_WIDTH = 620;
const MIN_DRAWER_WIDTH = 420;

const clampDrawerWidth = (width: number) =>
  Math.min(Math.max(width, MIN_DRAWER_WIDTH), Math.max(MIN_DRAWER_WIDTH, window.innerWidth - 320));

const readDrawerWidth = () => {
  const stored = Number(localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY));
  return clampDrawerWidth(Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_DRAWER_WIDTH);
};

export const CodexSubagentParentLink: React.FC<{ conversation: CodexConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const parentId = conversation.extra.codex_parent_conversation_id;
  if (!parentId) return null;
  return (
    <Button
      size='mini'
      type='secondary'
      icon={<Robot size={14} />}
      onClick={() => void navigate(`/conversation/${parentId}`)}
    >
      {t('codex.subagents.back')}
    </Button>
  );
};

const relativeTime = (timestamp: number): string => {
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const CodexSubagentControl: React.FC<{ conversation: CodexConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const layout = useLayoutContext();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<CodexConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [drawerWidth, setDrawerWidth] = useState(readDrawerWidth);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.database.getUserConversations.invoke({
        codex_parent_conversation_id: conversation.id,
        limit: 100,
      });
      setChildren(
        (result.items ?? []).filter(
          (item): item is CodexConversation =>
            item.type === 'codex-app-server' && item.extra.codex_thread_role === 'subagent'
        )
      );
    } catch (error) {
      console.error('[CodexSubagents] Failed to load sub-agents', error);
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    if (visible) void loadChildren();
  }, [loadChildren, visible]);

  useEffect(() => {
    return ipcBridge.conversation.listChanged.on(() => {
      if (visible) void loadChildren();
    });
  }, [loadChildren, visible]);

  useEffect(() => {
    const handleResize = () => setDrawerWidth((width) => clampDrawerWidth(width));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selected = useMemo(() => children.find((item) => item.id === selectedId), [children, selectedId]);
  const running = children.filter((item) => item.status === 'running');
  const completed = children.filter((item) => item.status !== 'running');
  const runningCount = conversation.extra.codex_subagent_running_count ?? running.length;
  const completedCount = conversation.extra.codex_subagent_completed_count ?? completed.length;
  const totalCount = conversation.extra.codex_subagent_total_count ?? runningCount + completedCount;

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (layout?.isMobile) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = drawerWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const handlePointerMove = (moveEvent: PointerEvent) => {
        setDrawerWidth(clampDrawerWidth(startWidth + startX - moveEvent.clientX));
      };
      const handlePointerUp = (upEvent: PointerEvent) => {
        const width = clampDrawerWidth(startWidth + startX - upEvent.clientX);
        setDrawerWidth(width);
        localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(Math.round(width)));
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [drawerWidth, layout?.isMobile]
  );

  const renderRow = (child: CodexConversation) => {
    const isRunning = child.status === 'running';
    const subtitle =
      child.extra.codex_last_message_preview ||
      child.extra.codex_agent_role ||
      child.extra.codex_agent_nickname ||
      child.extra.codex_subagent_kind;
    return (
      <button
        key={child.id}
        type='button'
        className='w-full flex items-start gap-10px px-10px py-10px rounded-10px text-left hover:bg-fill-2 transition-colors'
        onClick={() => setSelectedId(child.id)}
      >
        <span
          className={`mt-2px size-22px rounded-full flex-center shrink-0 ${isRunning ? 'bg-[rgba(var(--primary-6),0.14)] text-[rgb(var(--primary-6))]' : 'bg-fill-2 text-t-secondary'}`}
        >
          {isRunning ? <Spin size={14} /> : <Robot size={14} />}
        </span>
        <span className='min-w-0 flex-1'>
          <span className='flex items-center gap-8px'>
            <span className='font-[500] text-14px text-t-primary truncate flex-1'>{child.name}</span>
            <span className='text-12px text-t-tertiary shrink-0'>{relativeTime(child.modified_at)}</span>
          </span>
          <span className='block text-12px text-t-secondary truncate mt-2px'>
            {subtitle || (isRunning ? t('codex.subagents.running') : t('codex.subagents.completed'))}
          </span>
        </span>
        <Right size={14} className='mt-4px text-t-tertiary shrink-0' />
      </button>
    );
  };

  return (
    <>
      <Button
        size='mini'
        type={runningCount > 0 ? 'primary' : 'secondary'}
        icon={<Robot size={14} />}
        onClick={() => setVisible(true)}
      >
        {t('codex.subagents.title')}
        {totalCount > 0 && ` ${runningCount > 0 ? runningCount : totalCount}`}
      </Button>
      <Drawer
        title={selected?.name ?? t('codex.subagents.title')}
        visible={visible}
        width={layout?.isMobile ? '100%' : drawerWidth}
        placement='right'
        footer={null}
        unmountOnExit
        bodyStyle={{
          padding: selected ? 0 : 16,
          overflow: 'hidden',
          position: 'relative',
        }}
        onCancel={() => {
          setVisible(false);
          setSelectedId(undefined);
        }}
      >
        {!layout?.isMobile && (
          <div
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize sub-agent drawer'
            className='group absolute left-0 top-0 bottom-0 z-50 w-10px cursor-col-resize touch-none'
            onPointerDown={handleResizeStart}
          >
            <span className='absolute left-0 top-0 bottom-0 w-2px bg-transparent group-hover:bg-[rgb(var(--primary-6))] group-active:bg-[rgb(var(--primary-6))] transition-colors' />
          </div>
        )}
        {selected ? (
          <div className='h-full flex flex-col min-h-0'>
            <div className='flex items-center gap-8px px-16px py-10px border-b border-[var(--bg-3)] shrink-0'>
              <Button size='mini' type='text' onClick={() => setSelectedId(undefined)}>
                {t('codex.subagents.back')}
              </Button>
              <div className='min-w-0 flex-1'>
                <div className='text-12px text-t-tertiary truncate'>
                  {selected.extra.codex_agent_nickname ||
                    selected.extra.codex_agent_role ||
                    selected.extra.codex_subagent_kind}
                </div>
              </div>
              <Tag color={selected.status === 'running' ? 'arcoblue' : 'gray'}>
                {selected.status === 'running' ? t('codex.subagents.running') : t('codex.subagents.completed')}
              </Tag>
              <Button
                size='mini'
                type='text'
                onClick={() => {
                  setVisible(false);
                  void navigate(`/conversation/${selected.id}`);
                }}
              >
                {t('codex.subagents.openFullConversation')}
              </Button>
            </div>
            <div className='flex-1 flex min-h-0 overflow-hidden bg-1'>
              <CodexNativeChat
                key={selected.id}
                conversation_id={selected.id}
                workspace={selected.extra.workspace}
                hideSendBox={selected.extra.codex_can_accept_direct_input === false}
                emptySlot={<Empty description={t('codex.subagents.noMessages')} />}
              />
            </div>
          </div>
        ) : loading && children.length === 0 ? (
          <div className='py-60px flex-center'>
            <Spin />
          </div>
        ) : children.length === 0 ? (
          <Empty description={t('codex.subagents.empty')} />
        ) : (
          <div className='h-full overflow-y-auto'>
            {running.length > 0 && (
              <section>
                <div className='text-13px text-t-tertiary mb-4px'>
                  {t('codex.subagents.started')} · {running.length}
                </div>
                <div className='space-y-2px'>{running.map(renderRow)}</div>
              </section>
            )}
            {completed.length > 0 && (
              <section className={running.length > 0 ? 'mt-18px' : ''}>
                <div className='text-13px text-t-tertiary mb-4px'>
                  {t('codex.subagents.completed')} · {completed.length}
                </div>
                <div className='space-y-2px'>{completed.map(renderRow)}</div>
              </section>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default CodexSubagentControl;
