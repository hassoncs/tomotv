import { componentRegistry } from '@/services/componentRegistry';

// Import registerComponents to trigger side effects (registration)
import '@/components/sdui/registerComponents';

describe('Toast component registration', () => {
  it('manifest includes Toast as primary component', () => {
    const manifest = componentRegistry.getManifest();
    const toast = manifest.find((c) => c.name === 'Toast');
    expect(toast).toBeDefined();
    expect(toast?.description).toMatch(/toast|notification|message/i);
  });

  it('manifest includes TextMessage as backward-compatible alias', () => {
    const manifest = componentRegistry.getManifest();
    const alias = manifest.find((c) => c.name === 'TextMessage');
    expect(alias).toBeDefined();
  });

  it('can render Toast via registry', () => {
    const el = componentRegistry.render('Toast', { text: 'Hello', style: 'info' });
    expect(el).not.toBeNull();
  });

  it('can render TextMessage alias via registry (backward compat)', () => {
    const el = componentRegistry.render('TextMessage', { text: 'Hello', style: 'info' });
    expect(el).not.toBeNull();
  });

  it('Toast and TextMessage produce same component type', () => {
    const toastEl = componentRegistry.render('Toast', { text: 'Hi' });
    const aliasEl = componentRegistry.render('TextMessage', { text: 'Hi' });
    expect(toastEl?.type).toBe(aliasEl?.type);
  });
});
