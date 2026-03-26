import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getApiDiagnosticsStateInvoke, showItemInFolderInvoke } = vi.hoisted(() => ({
  getApiDiagnosticsStateInvoke: vi.fn(),
  showItemInFolderInvoke: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    application: {
      getApiDiagnosticsState: { invoke: getApiDiagnosticsStateInvoke },
      updateApiDiagnosticsConfig: { invoke: vi.fn() },
      captureApiDiagnosticsSnapshot: { invoke: vi.fn() },
      getApiDiagnosticsLiveSnapshot: { invoke: vi.fn() },
      getApiDiagnosticsHistory: { invoke: vi.fn() },
    },
    shell: {
      showItemInFolder: { invoke: showItemInFolderInvoke },
    },
  },
}));

import { getExtensionHostApiHandlers } from '../../../src/renderer/components/settings/SettingsModal/contents/ExtensionSettingsTabContent/hostApiHandlers';

describe('getExtensionHostApiHandlers', () => {
  beforeEach(() => {
    getApiDiagnosticsStateInvoke.mockReset();
    showItemInFolderInvoke.mockReset();
  });

  it('returns diagnostics handlers for the embedded api diagnostics extension', async () => {
    getApiDiagnosticsStateInvoke.mockResolvedValue({ enabled: true });
    showItemInFolderInvoke.mockResolvedValue(undefined);

    const handlers = getExtensionHostApiHandlers('api-diagnostics-devtools', 'E:/logs/output.json');

    await expect(handlers?.['application.getApiDiagnosticsState']()).resolves.toEqual({ enabled: true });
    await expect(handlers?.['shell.showItemInFolder']()).resolves.toEqual({ success: true });
    expect(showItemInFolderInvoke).toHaveBeenCalledWith('E:/logs/output.json');
  });

  it('returns undefined for unrelated extensions and rejects invalid shell payloads', async () => {
    expect(getExtensionHostApiHandlers('star-office', null)).toBeUndefined();

    const handlers = getExtensionHostApiHandlers('api-diagnostics-devtools', '');

    await expect(handlers?.['shell.showItemInFolder']()).rejects.toThrow('Missing path');
    expect(showItemInFolderInvoke).not.toHaveBeenCalled();
  });
});
