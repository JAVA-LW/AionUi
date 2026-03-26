/**
 * Tests that SystemActions handles 'weixin' platform in all three ternary chains.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock electron before any imports
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp') },
}));

const mockGet = vi.fn();
vi.mock('@process/utils/initStorage', () => ({
  ProcessConfig: { get: mockGet },
}));

vi.mock('@process/channels/pairing/PairingService', () => ({
  getPairingService: vi.fn(() => ({})),
}));

vi.mock('@process/acp/connectors/acpConversationConnector', () => ({}));
vi.mock('@process/agent/acp/AcpDetector', () => ({
  acpDetector: { getDetectedAgents: vi.fn(() => []) },
}));
vi.mock('@/process/services/conversationServiceSingleton', () => ({
  conversationServiceSingleton: { createConversation: vi.fn() },
}));
vi.mock('@process/task/workerTaskManagerSingleton', () => ({
  workerTaskManager: { kill: vi.fn(), listTasks: vi.fn(() => []) },
}));
vi.mock('@process/channels/agent/ChannelMessageService', () => ({
  getChannelMessageService: vi.fn(() => ({ clearContext: vi.fn() })),
}));
vi.mock('@process/channels/core/ChannelManager', () => ({
  getChannelManager: vi.fn(() => ({
    getSessionManager: vi.fn(() => ({
      getSession: vi.fn(() => null),
      clearSession: vi.fn(),
      createSession: vi.fn(),
      createSessionWithConversation: vi.fn(),
    })),
  })),
}));
vi.mock('@process/channels/plugins/telegram/TelegramKeyboards', () => ({
  createAgentSelectionKeyboard: vi.fn(() => []),
  createHelpKeyboard: vi.fn(() => []),
  createMainMenuKeyboard: vi.fn(() => []),
  createSessionControlKeyboard: vi.fn(() => []),
}));
vi.mock('@process/channels/plugins/lark/LarkCards', () => ({
  createAgentSelectionCard: vi.fn(() => ({})),
  createFeaturesCard: vi.fn(() => ({})),
  createHelpCard: vi.fn(() => ({})),
  createMainMenuCard: vi.fn(() => ({})),
  createPairingGuideCard: vi.fn(() => ({})),
  createSessionStatusCard: vi.fn(() => ({})),
  createSettingsCard: vi.fn(() => ({})),
  createTipsCard: vi.fn(() => ({})),
}));
vi.mock('@process/channels/plugins/dingtalk/DingTalkCards', () => ({
  createAgentSelectionCard: vi.fn(() => ({})),
  createFeaturesCard: vi.fn(() => ({})),
  createHelpCard: vi.fn(() => ({})),
  createMainMenuCard: vi.fn(() => ({})),
  createPairingGuideCard: vi.fn(() => ({})),
  createSessionStatusCard: vi.fn(() => ({})),
  createSettingsCard: vi.fn(() => ({})),
  createTipsCard: vi.fn(() => ({})),
}));

// Also mock provider list (used inside getChannelDefaultModel)
vi.mock('@process/model/providerListStore', () => ({
  getProviderList: vi.fn(async () => []),
}));

let getChannelDefaultModel: typeof import('@process/channels/actions/SystemActions').getChannelDefaultModel;

describe('SystemActions weixin platform handling', () => {
  beforeAll(async () => {
    ({ getChannelDefaultModel } = await import('@process/channels/actions/SystemActions'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(undefined);
  });

  it('getChannelDefaultModel reads assistant.weixin.defaultModel for weixin platform', async () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'assistant.weixin.defaultModel') return Promise.resolve({ id: 'p1', useModel: 'gemini-2.0-flash' });
      return Promise.resolve(undefined);
    });

    // Function will fall through to provider fallback (providers list is empty)
    // but mockGet must have been called with the weixin key, not telegram
    try {
      await getChannelDefaultModel('weixin');
    } catch {
      // fallback throws when no provider found — that's fine, we check the key below
    }
    expect(mockGet).toHaveBeenCalledWith('assistant.weixin.defaultModel');
    expect(mockGet).not.toHaveBeenCalledWith('assistant.telegram.defaultModel');
  });

  it('getChannelDefaultModel still reads assistant.telegram.defaultModel for telegram', async () => {
    mockGet.mockResolvedValue(undefined);
    try {
      await getChannelDefaultModel('telegram');
    } catch {
      // fallback throws — fine
    }
    expect(mockGet).toHaveBeenCalledWith('assistant.telegram.defaultModel');
    expect(mockGet).not.toHaveBeenCalledWith('assistant.weixin.defaultModel');
  });
});
