import React from 'react';
import { create } from 'react-test-renderer';

// Mock NativeTabs — it's a native component unavailable in Jest
jest.mock('expo-router/unstable-native-tabs', () => ({
  NativeTabs: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Icon: () => null,
  Label: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Tab layout — AI tab replaces Help tab', () => {
  it('renders without crashing', () => {
    jest.isolateModules(() => {
      const TabLayout = require('../_layout').default;
      expect(() => create(<TabLayout />)).not.toThrow();
    });
  });

  it('_layout.tsx contains ai trigger name', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.join(__dirname, '../_layout.tsx'), 'utf8');
    expect(src).toContain('name="ai"');
  });

  it('_layout.tsx does not contain help trigger name', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.join(__dirname, '../_layout.tsx'), 'utf8');
    expect(src).not.toContain('name="help"');
  });

  it('_layout.tsx contains library, search, and settings triggers', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.join(__dirname, '../_layout.tsx'), 'utf8');
    expect(src).toContain('name="index"');
    expect(src).toContain('name="search"');
    expect(src).toContain('name="settings"');
  });
});