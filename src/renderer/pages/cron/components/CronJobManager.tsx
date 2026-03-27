/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconColors } from '@/renderer/styles/colors';
import { Button, Popover } from '@arco-design/web-react';
import { AlarmClock } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getJobStatusFlags } from '../cronUtils';
import { useCronJobs } from '../useCronJobs';

interface CronJobManagerProps {
  conversationId: string;
}

const CronJobManager: React.FC<CronJobManagerProps> = ({ conversationId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { jobs, loading, hasJobs } = useCronJobs(conversationId);

  const openControlPanel = () => {
    void navigate('/settings/cron');
  };

  if (!hasJobs && !loading) {
    return (
      <Popover
        trigger='hover'
        position='bottom'
        content={
          <div className='flex flex-col gap-8px p-4px max-w-240px'>
            <div className='text-13px text-t-secondary'>{t('cron.panel.entryHint')}</div>
            <Button type='primary' size='mini' onClick={openControlPanel}>
              {t('cron.panel.openPanelButton')}
            </Button>
          </div>
        }
      >
        <Button
          type='text'
          size='small'
          className='cron-job-manager-button chat-header-cron-pill !h-auto !w-auto !min-w-0 !px-0 !py-0'
          onClick={openControlPanel}
        >
          <span className='inline-flex items-center gap-2px rounded-full px-8px py-2px bg-2'>
            <AlarmClock theme='outline' size={16} fill={iconColors.disabled} />
            <span className='ml-4px h-8px w-8px rounded-full bg-[var(--color-text-4)]' />
          </span>
        </Button>
      </Popover>
    );
  }

  if (loading) {
    return null;
  }

  const job = jobs[0];
  if (!job) {
    return null;
  }

  const { hasError, isPaused } = getJobStatusFlags(job);

  return (
    <Button
      type='text'
      size='small'
      className='cron-job-manager-button chat-header-cron-pill !h-auto !w-auto !min-w-0 !px-0 !py-0'
      title={isPaused ? t('cron.status.paused') : hasError ? t('cron.status.error') : job.name}
      onClick={openControlPanel}
    >
      <span className='inline-flex items-center gap-2px rounded-full px-8px py-2px bg-2'>
        <AlarmClock theme='outline' size={16} fill={iconColors.primary} />
        <span
          className={`ml-4px h-8px w-8px rounded-full ${
            hasError
              ? 'bg-[var(--color-danger-6)]'
              : isPaused
                ? 'bg-[var(--color-warning-6)]'
                : 'bg-[var(--color-success-6)]'
          }`}
        />
      </span>
    </Button>
  );
};

export default CronJobManager;
