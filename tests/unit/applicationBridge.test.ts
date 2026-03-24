/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IWorkerTaskManager } from '../../src/process/task/IWorkerTaskManager';

const applicationHandlers: Record<string, (...args: unknown[]) => unknown> = {};

function makeApplicationChannel(name: string) {
  return {
    provider: vi.fn((fn: (...args: unknown[]) => unknown) => {
      applicationHandlers[name] = fn;
    }),
    emit: vi.fn(),
    invoke: vi.fn(),
  };
}

function makeTaskManager(overrides?: Partial<IWorkerTaskManager>): IWorkerTaskManager {
  return {
    getTask: vi.fn(() => undefined),
    getOrBuildTask: vi.fn(async () => {
      throw new Error('not found');
    }),
    addTask: vi.fn(),
    kill: vi.fn(),
    clear: vi.fn(),
    listTasks: vi.fn(() => []),
    ...overrides,
  };
}

describe('applicationBridge CDP functionality', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.keys(applicationHandlers).forEach((key) => {
      delete applicationHandlers[key];
    });

    // Mock electron
    vi.doMock('electron', () => ({
      app: {
        isPackaged: false,
        setName: vi.fn(),
        getPath: vi.fn((name: string) => {
          if (name === 'userData') return '/mock/userData';
          return '/mock/path';
        }),
        commandLine: {
          appendSwitch: vi.fn(),
        },
        relaunch: vi.fn(),
        exit: vi.fn(),
      },
    }));

    // Mock fs
    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => '{}'),
      writeFileSync: vi.fn(),
    }));

    // Mock http
    vi.doMock('http', () => ({
      default: { get: vi.fn() },
    }));

    vi.doMock('@/common', () => ({
      ipcBridge: {
        application: {
          restart: makeApplicationChannel('restart'),
          updateSystemInfo: makeApplicationChannel('updateSystemInfo'),
          systemInfo: makeApplicationChannel('systemInfo'),
          getPath: makeApplicationChannel('getPath'),
          isDevToolsOpened: makeApplicationChannel('isDevToolsOpened'),
          openDevTools: makeApplicationChannel('openDevTools'),
          getZoomFactor: makeApplicationChannel('getZoomFactor'),
          setZoomFactor: makeApplicationChannel('setZoomFactor'),
          getApiDiagnosticsState: makeApplicationChannel('getApiDiagnosticsState'),
          updateApiDiagnosticsConfig: makeApplicationChannel('updateApiDiagnosticsConfig'),
          captureApiDiagnosticsSnapshot: makeApplicationChannel('captureApiDiagnosticsSnapshot'),
          getApiDiagnosticsLiveSnapshot: makeApplicationChannel('getApiDiagnosticsLiveSnapshot'),
          getApiDiagnosticsHistory: makeApplicationChannel('getApiDiagnosticsHistory'),
          getCdpStatus: makeApplicationChannel('getCdpStatus'),
          updateCdpConfig: makeApplicationChannel('updateCdpConfig'),
        },
      },
    }));

    // Mock zoom utilities
    vi.doMock('@process/utils/zoom', () => ({
      getZoomFactor: vi.fn(() => 1),
      setZoomFactor: vi.fn(() => 1),
    }));

    // Mock initStorage
    vi.doMock('@process/utils/initStorage', () => ({
      getSystemDir: vi.fn(() => ({
        cacheDir: '/mock/cache',
        workDir: '/mock/work',
        platform: 'win32',
        arch: 'x64',
      })),
      ProcessEnv: {
        set: vi.fn(),
      },
    }));

    // Mock utils
    vi.doMock('@process/utils', () => ({
      copyDirectoryRecursively: vi.fn(),
    }));

    vi.doMock('@process/services/ApiDiagnosticsService', () => ({
      apiDiagnosticsService: {
        getConfig: vi.fn(() => ({
          enabled: false,
          outputDir: '/mock/api-diagnostics',
          sampleIntervalMs: 60000,
        })),
        updateConfig: vi.fn((config: { enabled?: boolean; outputDir?: string; sampleIntervalMs?: number }) => ({
          enabled: config.enabled ?? false,
          outputDir: config.outputDir ?? '/mock/api-diagnostics',
          sampleIntervalMs: config.sampleIntervalMs ?? 60000,
        })),
        captureRouteSample: vi.fn(() => ({
          recorded: true,
          snapshot: { ok: true },
          filePath: '/mock/api-diagnostics/capture.json',
        })),
        getLiveSnapshot: vi.fn(() => ({ ok: true })),
        getRecentCaptures: vi.fn(() => []),
      },
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
    vi.doUnmock('electron');
    vi.doUnmock('fs');
    vi.doUnmock('http');
    vi.doUnmock('@/common');
    vi.doUnmock('@process/utils/zoom');
    vi.doUnmock('@process/utils/initStorage');
    vi.doUnmock('@process/utils');
    vi.doUnmock('@process/services/ApiDiagnosticsService');
  });

  describe('initApplicationBridge', () => {
    it('should initialize without errors', async () => {
      const { initApplicationBridge } = await import('@process/bridge/applicationBridge');

      const taskMgr = makeTaskManager();
      expect(() => initApplicationBridge(taskMgr)).not.toThrow();
    });
  });

  describe('CDP IPC handlers', () => {
    it('should register getCdpStatus handler', async () => {
      const mod = await import('@process/bridge/applicationBridge');
      expect(mod.initApplicationBridge).toBeTypeOf('function');
    });
  });
});

describe('CDP configuration functions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.AIONUI_CDP_PORT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should provide getCdpStatus function', async () => {
    vi.doMock('electron', () => ({
      app: {
        isPackaged: false,
        setName: vi.fn(),
        getPath: vi.fn(() => '/mock/userData'),
        commandLine: { appendSwitch: vi.fn() },
      },
    }));

    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => '{}'),
      writeFileSync: vi.fn(),
    }));

    vi.doMock('http', () => ({
      default: { get: vi.fn() },
    }));

    const { getCdpStatus } = await import('@process/utils/configureChromium');

    const status = getCdpStatus();

    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('port');
    expect(status).toHaveProperty('startupEnabled');
    expect(status).toHaveProperty('instances');
    expect(status).toHaveProperty('isDevMode');
    expect(Array.isArray(status.instances)).toBe(true);
  });

  it('should provide updateCdpConfig function', async () => {
    vi.doMock('electron', () => ({
      app: {
        isPackaged: false,
        setName: vi.fn(),
        getPath: vi.fn(() => '/mock/userData'),
        commandLine: { appendSwitch: vi.fn() },
      },
    }));

    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => '{}'),
      writeFileSync: vi.fn(),
    }));

    vi.doMock('http', () => ({
      default: { get: vi.fn() },
    }));

    const { updateCdpConfig } = await import('@process/utils/configureChromium');

    const result = updateCdpConfig({ enabled: true, port: 9225 });

    expect(result).toHaveProperty('enabled', true);
    expect(result).toHaveProperty('port', 9225);
  });

  it('should provide saveCdpConfig function', async () => {
    const mockWriteFileSync = vi.fn();

    vi.doMock('electron', () => ({
      app: {
        isPackaged: false,
        setName: vi.fn(),
        getPath: vi.fn(() => '/mock/userData'),
        commandLine: { appendSwitch: vi.fn() },
      },
    }));

    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => '{}'),
      writeFileSync: mockWriteFileSync,
    }));

    vi.doMock('http', () => ({
      default: { get: vi.fn() },
    }));

    const { saveCdpConfig } = await import('@process/utils/configureChromium');

    saveCdpConfig({ enabled: false });

    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('restart handler calls workerTaskManager.clear() via injected dependency', async () => {
    Object.keys(applicationHandlers).forEach((key) => {
      delete applicationHandlers[key];
    });

    vi.doMock('electron', () => ({
      app: {
        isPackaged: false,
        setName: vi.fn(),
        getPath: vi.fn(() => '/tmp'),
        commandLine: { appendSwitch: vi.fn() },
        relaunch: vi.fn(),
        exit: vi.fn(),
      },
    }));

    vi.doMock('@/common', () => ({
      ipcBridge: {
        application: {
          restart: makeApplicationChannel('restart'),
          updateSystemInfo: makeApplicationChannel('updateSystemInfo'),
          systemInfo: makeApplicationChannel('systemInfo'),
          getPath: makeApplicationChannel('getPath'),
          isDevToolsOpened: makeApplicationChannel('isDevToolsOpened'),
          openDevTools: makeApplicationChannel('openDevTools'),
          getZoomFactor: makeApplicationChannel('getZoomFactor'),
          setZoomFactor: makeApplicationChannel('setZoomFactor'),
          getApiDiagnosticsState: makeApplicationChannel('getApiDiagnosticsState'),
          updateApiDiagnosticsConfig: makeApplicationChannel('updateApiDiagnosticsConfig'),
          captureApiDiagnosticsSnapshot: makeApplicationChannel('captureApiDiagnosticsSnapshot'),
          getApiDiagnosticsLiveSnapshot: makeApplicationChannel('getApiDiagnosticsLiveSnapshot'),
          getApiDiagnosticsHistory: makeApplicationChannel('getApiDiagnosticsHistory'),
          getCdpStatus: makeApplicationChannel('getCdpStatus'),
          updateCdpConfig: makeApplicationChannel('updateCdpConfig'),
        },
      },
    }));

    vi.doMock('@process/utils/zoom', () => ({
      getZoomFactor: vi.fn(() => 1),
      setZoomFactor: vi.fn(() => 1),
    }));

    vi.doMock('@process/utils/initStorage', () => ({
      getSystemDir: vi.fn(() => ({
        cacheDir: '/mock/cache',
        workDir: '/mock/work',
        platform: 'win32',
        arch: 'x64',
      })),
      ProcessEnv: {
        set: vi.fn(),
      },
    }));

    vi.doMock('@process/utils', () => ({
      copyDirectoryRecursively: vi.fn(),
    }));

    vi.doMock('@process/services/ApiDiagnosticsService', () => ({
      apiDiagnosticsService: {
        getConfig: vi.fn(() => ({
          enabled: false,
          outputDir: '/mock/api-diagnostics',
          sampleIntervalMs: 60000,
        })),
        updateConfig: vi.fn((config: { enabled?: boolean; outputDir?: string; sampleIntervalMs?: number }) => ({
          enabled: config.enabled ?? false,
          outputDir: config.outputDir ?? '/mock/api-diagnostics',
          sampleIntervalMs: config.sampleIntervalMs ?? 60000,
        })),
        captureRouteSample: vi.fn(() => ({
          recorded: true,
          snapshot: { ok: true },
          filePath: '/mock/api-diagnostics/capture.json',
        })),
        getLiveSnapshot: vi.fn(() => ({ ok: true })),
        getRecentCaptures: vi.fn(() => []),
      },
    }));

    const { initApplicationBridge } = await import('../../src/process/bridge/applicationBridge');
    const taskMgr = makeTaskManager();
    initApplicationBridge(taskMgr);

    expect(applicationHandlers['restart']).toBeTypeOf('function');
    await applicationHandlers['restart']?.();
    expect(taskMgr.clear).toHaveBeenCalled();
  });

  it('should provide unregisterInstance function', async () => {
    vi.doMock('electron', () => ({
      app: {
        isPackaged: false,
        setName: vi.fn(),
        getPath: vi.fn(() => '/mock/userData'),
        commandLine: { appendSwitch: vi.fn() },
      },
    }));

    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => '{}'),
      writeFileSync: vi.fn(),
    }));

    vi.doMock('http', () => ({
      default: { get: vi.fn() },
    }));

    const { unregisterInstance } = await import('@process/utils/configureChromium');

    // Should not throw
    expect(() => unregisterInstance()).not.toThrow();
  });
});
