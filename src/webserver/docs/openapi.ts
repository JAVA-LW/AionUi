/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export function buildOpenApiSpec(): Record<string, any> {
  return {
    openapi: '3.0.3',
    info: {
      title: 'AionUi HTTP API',
      version: '1.0.0',
      description:
        'AionUi conversation API documentation with interactive request testing. Set `Authorization: Bearer <api_token>` in Swagger Authorize.',
    },
    servers: [
      {
        url: '/',
        description: 'Current AionUi server',
      },
    ],
    tags: [
      { name: 'Conversation API', description: 'Create and manage AI conversations' },
      { name: 'Testing', description: 'Simulation endpoints for integration testing' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Token',
          description: 'API token generated in Settings > API',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Invalid API token' },
          },
          required: ['success', 'error'],
        },
        ConversationCreateRequest: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['gemini', 'acp', 'codex', 'openclaw-gateway', 'nanobot'],
              example: 'gemini',
              description: 'Conversation type. Preferred over `cli`.',
            },
            cli: {
              type: 'string',
              example: 'claude',
              description:
                'Alias for `type`/ACP backend. Supports conversation types or ACP backend names (e.g. claude, qwen, codex).',
            },
            model: {
              type: 'object',
              description: 'Model object used by AionUi',
              additionalProperties: true,
              example: {
                id: 'default-provider',
                platform: 'openai',
                name: 'OpenAI',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: '***',
                useModel: 'gpt-4o-mini',
              },
            },
            workspace: { type: 'string', example: 'E:/code/project' },
            backend: {
              type: 'string',
              example: 'claude',
              description: 'ACP backend. Required when type/cli resolves to `acp`.',
            },
            mode: {
              type: 'string',
              example: 'default',
              description: 'Session mode alias. Mapped to sessionMode in conversation extra.',
            },
            sessionMode: {
              type: 'string',
              example: 'default',
              description: 'Alternative name of `mode`.',
            },
            cliPath: {
              type: 'string',
              example: 'npx @qwen-code/qwen-code',
              description: 'Optional custom CLI command/path.',
            },
            currentModelId: {
              type: 'string',
              example: 'claude-sonnet-4',
              description: 'Pre-selected ACP model ID.',
            },
            codexModel: {
              type: 'string',
              example: 'gpt-5-codex',
              description: 'Pre-selected Codex model ID.',
            },
            agentName: {
              type: 'string',
              example: 'Claude Code',
              description: 'Optional agent display name.',
            },
            customAgentId: {
              type: 'string',
              example: 'b9f0d7a1-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
              description: 'Custom agent UUID when backend is `custom`.',
            },
            message: { type: 'string', example: 'Hello, introduce yourself.' },
            waitForDispatch: {
              type: 'boolean',
              default: false,
              description: 'When true, wait until first message dispatch completes before returning.',
            },
          },
          required: ['model', 'message'],
        },
        ConversationCreateResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            sessionId: { type: 'string', example: 'conv_1741000000000' },
            status: { type: 'string', example: 'running' },
          },
          required: ['success', 'sessionId', 'status'],
        },
        ConversationMessageRequest: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Continue from previous answer.' },
            waitForDispatch: {
              type: 'boolean',
              default: false,
              description: 'When true, wait until message dispatch completes before returning.',
            },
          },
          required: ['message'],
        },
        ConversationStatusResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            sessionId: { type: 'string', example: 'conv_1741000000000' },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'finished'],
              example: 'running',
              description: 'Legacy high-level status for backward compatibility',
            },
            state: {
              type: 'string',
              enum: ['ai_generating', 'ai_waiting_input', 'ai_waiting_confirmation', 'initializing', 'stopped', 'error', 'unknown'],
              example: 'ai_generating',
              description: 'Detailed runtime state',
            },
            detail: { type: 'string', example: 'AI is generating response' },
            canSendMessage: { type: 'boolean', example: false },
            runtime: {
              type: 'object',
              description: 'Debug/runtime details used for state derivation',
              additionalProperties: true,
            },
            lastMessage: {
              type: 'object',
              nullable: true,
              additionalProperties: true,
            },
          },
          required: ['success', 'sessionId', 'status'],
        },
        ConversationMessagesResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            messages: {
              type: 'array',
              items: { type: 'object', additionalProperties: true },
            },
            total: { type: 'integer', example: 12 },
            page: { type: 'integer', example: 0 },
            pageSize: { type: 'integer', example: 50 },
            hasMore: { type: 'boolean', example: false },
          },
          required: ['success', 'messages', 'total', 'page', 'pageSize', 'hasMore'],
        },
        SimulationRequest: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['create', 'message', 'status', 'stop', 'messages'],
              example: 'create',
            },
            sessionId: {
              type: 'string',
              example: 'conv_example_001',
              description: 'Used by message/status/stop/messages simulations',
            },
            payload: {
              type: 'object',
              additionalProperties: true,
              description: 'Optional request payload override for simulation',
            },
          },
          required: ['action'],
        },
      },
    },
    paths: {
      '/api/v1/conversation/create': {
        post: {
          tags: ['Conversation API'],
          summary: 'Create conversation and send first message',
          description: 'Requires `model`, `message`, and one of `type` or `cli`.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ConversationCreateRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Conversation created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ConversationCreateResponse' },
                },
              },
            },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/v1/conversation/status': {
        get: {
          tags: ['Conversation API'],
          summary: 'Get conversation status',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Status result',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ConversationStatusResponse' },
                },
              },
            },
            404: { description: 'Conversation not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/v1/conversation/stop': {
        post: {
          tags: ['Conversation API'],
          summary: 'Stop ongoing generation',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Stopped',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      sessionId: { type: 'string' },
                      status: { type: 'string', example: 'finished' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/conversation/message': {
        post: {
          tags: ['Conversation API'],
          summary: 'Send a follow-up message',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ConversationMessageRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Accepted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      sessionId: { type: 'string' },
                      status: { type: 'string', example: 'running' },
                    },
                  },
                },
              },
            },
            409: { description: 'AI busy', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/v1/conversation/messages': {
        get: {
          tags: ['Conversation API'],
          summary: 'Get conversation message history',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'page',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 0 },
            },
            {
              name: 'pageSize',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 50, maximum: 100 },
            },
          ],
          responses: {
            200: {
              description: 'Message list',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ConversationMessagesResponse' },
                },
              },
            },
          },
        },
      },
      '/api/v1/conversation/simulate': {
        post: {
          tags: ['Testing'],
          summary: 'Simulate API request (no model execution)',
          description:
            'Returns sample method/path/body/response and a ready-to-run curl command. This endpoint does not create or execute a real conversation.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SimulationRequest' },
              },
            },
          },
          responses: {
            200: {
              description: 'Simulation result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      simulation: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
