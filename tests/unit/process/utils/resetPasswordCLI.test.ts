/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { resolveResetPasswordUsername } from '@process/utils/resetPasswordCLI';

describe('resolveResetPasswordUsername', () => {
  it('returns admin when resetpass is missing', () => {
    expect(resolveResetPasswordUsername(['node', 'server.mjs'])).toBe('admin');
  });

  it('returns admin when resetpass has no username', () => {
    expect(resolveResetPasswordUsername(['node', 'server.mjs', '--resetpass'])).toBe('admin');
  });

  it('returns the first positional arg after resetpass', () => {
    expect(resolveResetPasswordUsername(['node', 'server.mjs', '--resetpass', 'alice'])).toBe('alice');
  });

  it('skips flags and still resolves username', () => {
    expect(resolveResetPasswordUsername(['node', 'server.mjs', '--resetpass', '--verbose', 'alice'])).toBe('alice');
  });
});
