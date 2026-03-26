/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import ApiSettingsContent from '@/renderer/components/settings/SettingsModal/contents/ApiSettingsContent';
import WebuiModalContent from '@/renderer/components/settings/SettingsModal/contents/WebuiModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const WebuiSettings: React.FC = () => {
  const location = useLocation();
  const isApiPage = location.pathname === '/settings/api';

  return (
    <SettingsPageWrapper contentClassName={isApiPage ? 'max-w-1280px' : undefined}>
      {isApiPage ? <ApiSettingsContent /> : <WebuiModalContent />}
    </SettingsPageWrapper>
  );
};

export default WebuiSettings;
