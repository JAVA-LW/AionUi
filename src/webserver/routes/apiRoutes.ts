/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Express, Request, Response } from 'express';
import { TokenMiddleware } from '@/webserver/auth/middleware/TokenMiddleware';
import directoryApi from '../directoryApi';
import conversationApiRoutes from './conversationApiRoutes';
import { apiRateLimiter } from '../middleware/security';
import * as swaggerUi from 'swagger-ui-express';
import { buildOpenApiSpec } from '../docs/openapi';

/**
 * 注册 API 路由
 * Register API routes
 */
export function registerApiRoutes(app: Express): void {
  const validateApiAccess = TokenMiddleware.validateToken({ responseType: 'json' });
  const openApiSpec = buildOpenApiSpec();

  /**
   * API documentation
   * GET /api/openapi.json
   * GET /api/docs
   */
  app.get('/api/openapi.json', validateApiAccess, (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  app.use(
    '/api/docs',
    validateApiAccess,
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      explorer: true,
      customSiteTitle: 'AionUi API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
      },
    })
  );

  /**
   * 目录 API - Directory API
   * /api/directory/*
   */
  app.use('/api/directory', apiRateLimiter, validateApiAccess, directoryApi);

  /**
   * 会话 API - Conversation API
   * /api/v1/conversation/*
   */
  app.use('/api/v1/conversation', conversationApiRoutes);

  /**
   * 通用 API 端点 - Generic API endpoint
   * GET /api
   */
  app.use('/api', apiRateLimiter, validateApiAccess, (_req: Request, res: Response) => {
    res.json({
      message: 'API endpoint - bridge integration working',
      docs: '/api/docs',
      openapi: '/api/openapi.json',
      simulate: '/api/v1/conversation/simulate',
    });
  });
}

export default registerApiRoutes;
