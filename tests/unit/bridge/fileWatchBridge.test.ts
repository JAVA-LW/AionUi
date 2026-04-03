/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => unknown | Promise<unknown>;

class FakeWatcher extends EventEmitter {
  close = vi.fn();
}

const { handlers, fileAddedEmit, watchMock, accessSyncMock, createdWatchers } = vi.hoisted(() => ({
  handlers: {} as Record<string, Handler>,
  fileAddedEmit: vi.fn(),
  watchMock: vi.fn(),
  accessSyncMock: vi.fn(),
  createdWatchers: [] as FakeWatcher[],
}));

function makeChannel(name: string) {
  return {
    provider: vi.fn((fn: Handler) => {
      handlers[name] = fn;
    }),
    emit: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(() => () => {}),
  };
}

vi.mock('@/common', () => ({
  ipcBridge: {
    fileWatch: {
      startWatch: makeChannel('startWatch'),
      stopWatch: makeChannel('stopWatch'),
      stopAllWatches: makeChannel('stopAllWatches'),
      fileChanged: { emit: vi.fn() },
    },
    workspaceOfficeWatch: {
      start: makeChannel('workspaceStart'),
      stop: makeChannel('workspaceStop'),
      fileAdded: {
        emit: fileAddedEmit,
        on: vi.fn(() => () => {}),
      },
    },
  },
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: {
      ...actual,
      watch: watchMock,
      accessSync: accessSyncMock,
    },
    watch: watchMock,
    accessSync: accessSyncMock,
  };
});

import { initFileWatchBridge } from '../../../src/process/bridge/fileWatchBridge';

function getWorkspaceStartHandler() {
  const handler = handlers.workspaceStart;
  expect(handler).toBeTypeOf('function');
  return handler as (args: { workspace: string }) => Promise<{ success: boolean; msg?: string }>;
}

function getWatchCallback(): (eventType: string, filename: string) => void {
  const watchCall = watchMock.mock.calls[0] || [];
  return watchCall[watchCall.length - 1] as (eventType: string, filename: string) => void;
}

describe('fileWatchBridge workspace office watcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('Bun', {});
    createdWatchers.length = 0;
    watchMock.mockImplementation(() => {
      const watcher = new FakeWatcher();
      createdWatchers.push(watcher);
      return watcher as unknown as import('fs').FSWatcher;
    });
    accessSyncMock.mockImplementation(() => undefined);
    initFileWatchBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('avoids recursive workspace watch in Bun so unreadable descendants do not crash startup', async () => {
    const startWorkspaceWatch = getWorkspaceStartHandler();

    const result = await startWorkspaceWatch({ workspace: '/workspace' });

    expect(result).toEqual({ success: true });
    expect(watchMock).toHaveBeenCalledWith('/workspace', expect.any(Function));
  });

  it('emits only newly created office files that still exist in the workspace', async () => {
    const startWorkspaceWatch = getWorkspaceStartHandler();
    await startWorkspaceWatch({ workspace: '/workspace' });

    const watchCallback = getWatchCallback();
    watchCallback('rename', 'report.docx');
    watchCallback('change', 'ignored.docx');
    watchCallback('rename', 'notes.txt');

    expect(fileAddedEmit).toHaveBeenCalledOnce();
    expect(fileAddedEmit).toHaveBeenCalledWith({
      filePath: '/workspace/report.docx',
      workspace: '/workspace',
    });
  });

  it('handles async watcher errors without throwing and closes the broken watcher', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const startWorkspaceWatch = getWorkspaceStartHandler();

    await startWorkspaceWatch({ workspace: '/workspace' });
    const watcher = createdWatchers[0];
    const error = new Error('EACCES: permission denied, open /workspace/restricted');

    expect(() => watcher.emit('error', error)).not.toThrow();
    expect(watcher.close).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith('[WorkspaceOfficeWatch] Watcher error:', error);
  });
});
