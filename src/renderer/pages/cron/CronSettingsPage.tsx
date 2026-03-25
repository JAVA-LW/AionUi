/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { ICronJob } from '@/common/adapter/ipcBridge';
import type { TChatConversation } from '@/common/config/storage';
import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';
import { useConversationAgents } from '@/renderer/pages/conversation/hooks/useConversationAgents';
import { useAllCronJobs } from '@/renderer/pages/cron/useCronJobs';
import { Button, Card, Message, Popconfirm, Spin } from '@arco-design/web-react';
import { AlarmClock, ArrowRight, Pause, Play, Plus, SettingConfig, DeleteOne } from '@icon-park/react';
import dayjs from 'dayjs';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import CronJobDrawer from './components/CronJobDrawer';

const CronSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { jobs, loading, pauseJob, resumeJob, deleteJob, runJobNow } = useAllCronJobs();
  const { cliAgents, presetAssistants, isLoading: loadingAgents } = useConversationAgents();
  const { data: conversations = [], isLoading: loadingConversations } = useSWR('cron.settings.conversations', () =>
    ipcBridge.database.getUserConversations.invoke({ page: 0, pageSize: 10000 })
  );

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const availableAgents = useMemo(() => [...cliAgents, ...presetAssistants], [cliAgents, presetAssistants]);
  const conversationsMap = useMemo(
    () => new Map(conversations.map((conversation) => [conversation.id, conversation])),
    [conversations]
  );
  const sortedJobs = useMemo(
    () =>
      [...jobs].toSorted((left, right) => {
        const leftNextRun = left.state.nextRunAtMs ?? Number.MAX_SAFE_INTEGER;
        const rightNextRun = right.state.nextRunAtMs ?? Number.MAX_SAFE_INTEGER;
        return leftNextRun - rightNextRun;
      }),
    [jobs]
  );

  const selectedJob = useMemo(
    () => sortedJobs.find((job) => job.id === selectedJobId) ?? null,
    [selectedJobId, sortedJobs]
  );
  const selectedConversation = selectedJob ? (conversationsMap.get(selectedJob.metadata.conversationId) ?? null) : null;

  const openCreateDrawer = () => {
    setDrawerMode('create');
    setSelectedJobId(null);
    setDrawerVisible(true);
  };

  const openEditDrawer = (jobId: string) => {
    setDrawerMode('edit');
    setSelectedJobId(jobId);
    setDrawerVisible(true);
  };

  const handleRunNow = async (jobId: string) => {
    try {
      await runJobNow(jobId);
      Message.success(t('cron.runNowSuccess'));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleToggleEnabled = async (jobId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await resumeJob(jobId);
        Message.success(t('cron.resumeSuccess'));
      } else {
        await pauseJob(jobId);
        Message.success(t('cron.pauseSuccess'));
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      Message.success(t('cron.deleteSuccess'));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const isInitialLoading = loading || loadingConversations;

  return (
    <SettingsPageWrapper contentClassName='max-w-1280px'>
      <div className='space-y-16px'>
        <div className='flex flex-wrap items-end justify-between gap-12px'>
          <div className='space-y-6px'>
            <div className='flex items-center gap-8px text-24px font-semibold text-t-primary'>
              <AlarmClock theme='outline' size={22} />
              <span>{t('cron.panel.pageTitle')}</span>
            </div>
            <div className='max-w-720px text-14px text-t-secondary'>{t('cron.panel.pageDescription')}</div>
          </div>

          <Button
            type='primary'
            icon={<Plus theme='outline' size={14} />}
            disabled={loadingAgents || availableAgents.length === 0}
            onClick={openCreateDrawer}
          >
            {t('cron.panel.createButton')}
          </Button>
        </div>

        {loadingAgents && availableAgents.length === 0 ? (
          <div className='rounded-16px bg-2 px-18px py-20px text-14px text-t-secondary'>{t('common.loading')}</div>
        ) : null}

        {isInitialLoading ? (
          <div className='flex min-h-240px items-center justify-center'>
            <Spin loading size={36} />
          </div>
        ) : sortedJobs.length === 0 ? (
          <div className='rounded-20px bg-2 px-24px py-28px text-center'>
            <div className='text-18px font-medium text-t-primary'>{t('cron.panel.emptyTitle')}</div>
            <div className='mt-8px text-14px text-t-secondary'>{t('cron.panel.emptyDescription')}</div>
            <div className='mt-16px'>
              <Button type='primary' disabled={availableAgents.length === 0} onClick={openCreateDrawer}>
                {t('cron.panel.createButton')}
              </Button>
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-16px xl:grid-cols-2'>
            {sortedJobs.map((job) => {
              const conversation = conversationsMap.get(job.metadata.conversationId);
              const statusText = getJobStatusText(t, job);
              const nextRunLabel = job.state.nextRunAtMs
                ? dayjs(job.state.nextRunAtMs).format('YYYY-MM-DD HH:mm')
                : '-';
              const lastRunLabel = job.state.lastRunAtMs
                ? dayjs(job.state.lastRunAtMs).format('YYYY-MM-DD HH:mm')
                : '-';
              const workspace = conversation?.extra?.workspace || t('cron.panel.noWorkspace');
              const agentLabel = getConversationAgentLabel(conversation, job);

              return (
                <Card
                  key={job.id}
                  className='!rounded-20px'
                  bodyStyle={{ padding: 18 }}
                  title={
                    <div className='flex items-center justify-between gap-12px'>
                      <div className='min-w-0'>
                        <div className='truncate text-16px font-semibold text-t-primary'>{job.name}</div>
                        <div className='mt-4px text-12px text-t-secondary'>
                          {t('cron.panel.linkedConversation')}:{' '}
                          {conversation?.name || job.metadata.conversationTitle || '-'}
                        </div>
                      </div>
                      <div className={`rounded-full px-10px py-4px text-12px font-medium ${getJobStatusTone(job)}`}>
                        {statusText}
                      </div>
                    </div>
                  }
                >
                  <div className='space-y-12px'>
                    <div className='grid grid-cols-1 gap-10px md:grid-cols-2'>
                      <InfoRow label={t('cron.panel.agentLabel')} value={agentLabel} />
                      <InfoRow label={t('cron.panel.workspaceLabel')} value={workspace} />
                      <InfoRow label={t('cron.drawer.schedule')} value={job.schedule.description} />
                      <InfoRow label={t('cron.drawer.nextRun')} value={nextRunLabel} />
                      <InfoRow label={t('cron.lastRun')} value={lastRunLabel} />
                      <InfoRow label={t('cron.lastError')} value={job.state.lastError || '-'} />
                    </div>

                    <div className='rounded-16px bg-bg-1 px-14px py-12px'>
                      <div className='mb-6px text-12px font-medium text-t-secondary'>{t('cron.drawer.command')}</div>
                      <div className='line-clamp-4 whitespace-pre-wrap break-words text-14px text-t-primary'>
                        {job.target.payload.text}
                      </div>
                    </div>

                    <div className='flex flex-wrap items-center gap-8px'>
                      <Button icon={<SettingConfig theme='outline' size={14} />} onClick={() => openEditDrawer(job.id)}>
                        {t('common.edit')}
                      </Button>
                      <Button icon={<Play theme='outline' size={14} />} onClick={() => void handleRunNow(job.id)}>
                        {t('cron.actions.runNow')}
                      </Button>
                      <Button
                        icon={job.enabled ? <Pause theme='outline' size={14} /> : <Play theme='outline' size={14} />}
                        onClick={() => void handleToggleEnabled(job.id, !job.enabled)}
                      >
                        {job.enabled ? t('cron.actions.pause') : t('cron.actions.resume')}
                      </Button>
                      <Button
                        icon={<ArrowRight theme='outline' size={14} />}
                        onClick={() => {
                          void navigate(`/conversation/${job.metadata.conversationId}`);
                        }}
                      >
                        {t('cron.actions.goTo')}
                      </Button>
                      <Popconfirm title={t('cron.confirmDelete')} onOk={() => void handleDelete(job.id)}>
                        <Button status='danger' icon={<DeleteOne theme='outline' size={14} />}>
                          {t('cron.actions.delete')}
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CronJobDrawer
        visible={drawerVisible}
        mode={drawerMode}
        job={selectedJob}
        conversation={selectedConversation}
        availableAgents={availableAgents}
        onClose={() => setDrawerVisible(false)}
      />
    </SettingsPageWrapper>
  );
};

type InfoRowProps = {
  label: string;
  value: string;
};

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => {
  return (
    <div className='rounded-16px bg-2 px-14px py-12px'>
      <div className='text-12px text-t-secondary'>{label}</div>
      <div className='mt-4px break-words text-14px font-medium text-t-primary'>{value}</div>
    </div>
  );
};

function getConversationAgentLabel(conversation: TChatConversation | undefined, job: ICronJob): string {
  const agentName = getConversationAgentName(conversation);
  if (agentName) {
    return agentName;
  }

  const backend = getConversationBackend(conversation);
  if (backend) {
    return backend;
  }

  return job.metadata.agentType;
}

function getConversationAgentName(conversation?: TChatConversation | null): string | undefined {
  return conversation ? (conversation.extra as { agentName?: string }).agentName : undefined;
}

function getConversationBackend(conversation?: TChatConversation | null): string | undefined {
  return conversation ? (conversation.extra as { backend?: string }).backend : undefined;
}

function getJobStatusText(t: ReturnType<typeof useTranslation>['t'], job: ICronJob): string {
  if (job.state.lastStatus === 'error') {
    return t('cron.status.error');
  }

  if (!job.enabled) {
    return t('cron.status.paused');
  }

  return t('cron.status.active');
}

function getJobStatusTone(job: ICronJob): string {
  if (job.state.lastStatus === 'error') {
    return 'bg-[var(--color-danger-light-1)] text-[var(--color-danger-6)]';
  }

  if (!job.enabled) {
    return 'bg-[var(--color-warning-light-1)] text-[var(--color-warning-6)]';
  }

  return 'bg-[var(--color-success-light-1)] text-[var(--color-success-6)]';
}

export default CronSettingsPage;
