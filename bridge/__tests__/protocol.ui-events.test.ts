import {
  uiRenderParamsSchema,
  bridgeEventMethodSchema,
  eventPayloadSchemaMap,
  uiSelectEventSchema,
  uiActionEventSchema,
  uiDismissEventSchema,
} from '../protocol';

describe('ui.render — render target params', () => {
  it('accepts component + props with no target (defaults to canvas)', () => {
    const result = uiRenderParamsSchema.parse({ component: 'Toast', props: {} });
    expect(result.target).toBe('canvas');
    expect(result.navigateToTab).toBe(true);
  });

  it('accepts explicit target=overlay', () => {
    const result = uiRenderParamsSchema.parse({ component: 'Toast', target: 'overlay' });
    expect(result.target).toBe('overlay');
  });

  it('accepts explicit target=canvas with navigateToTab=false', () => {
    const result = uiRenderParamsSchema.parse({
      component: 'MediaGrid',
      target: 'canvas',
      navigateToTab: false,
    });
    expect(result.target).toBe('canvas');
    expect(result.navigateToTab).toBe(false);
  });

  it('rejects unknown target value', () => {
    expect(() => uiRenderParamsSchema.parse({ component: 'Toast', target: 'popup' })).toThrow();
  });

  it('is backward-compatible — component-only still parses', () => {
    const result = uiRenderParamsSchema.parse({ component: 'NowPlayingCard' });
    expect(result.component).toBe('NowPlayingCard');
  });
});

describe('bridgeEventMethodSchema — new UI event methods', () => {
  it('accepts event.ui.select', () => {
    expect(() => bridgeEventMethodSchema.parse('event.ui.select')).not.toThrow();
  });

  it('accepts event.ui.action', () => {
    expect(() => bridgeEventMethodSchema.parse('event.ui.action')).not.toThrow();
  });

  it('accepts event.ui.dismiss', () => {
    expect(() => bridgeEventMethodSchema.parse('event.ui.dismiss')).not.toThrow();
  });

  it('still accepts existing event methods', () => {
    expect(() => bridgeEventMethodSchema.parse('event.playback')).not.toThrow();
    expect(() => bridgeEventMethodSchema.parse('event.navigation')).not.toThrow();
    expect(() => bridgeEventMethodSchema.parse('event.queue')).not.toThrow();
  });
});

describe('uiSelectEventSchema', () => {
  it('parses required fields', () => {
    const result = uiSelectEventSchema.parse({ component: 'MediaGrid', itemId: 'abc123' });
    expect(result.component).toBe('MediaGrid');
    expect(result.itemId).toBe('abc123');
  });

  it('parses optional fields', () => {
    const result = uiSelectEventSchema.parse({
      component: 'MediaGrid',
      itemId: 'abc123',
      itemType: 'Movie',
      title: 'Inception',
    });
    expect(result.itemType).toBe('Movie');
    expect(result.title).toBe('Inception');
  });

  it('rejects missing itemId', () => {
    expect(() => uiSelectEventSchema.parse({ component: 'MediaGrid' })).toThrow();
  });
});

describe('uiActionEventSchema', () => {
  it('parses required fields', () => {
    const result = uiActionEventSchema.parse({ component: 'ConfirmationCard', actionId: 'confirm' });
    expect(result.actionId).toBe('confirm');
  });

  it('parses optional value', () => {
    const result = uiActionEventSchema.parse({
      component: 'ConfirmationCard',
      actionId: 'confirm',
      value: 'yes',
    });
    expect(result.value).toBe('yes');
  });
});

describe('uiDismissEventSchema', () => {
  it('parses required source field', () => {
    const result = uiDismissEventSchema.parse({ source: 'overlay' });
    expect(result.source).toBe('overlay');
  });

  it('parses optional component field', () => {
    const result = uiDismissEventSchema.parse({ source: 'canvas', component: 'MediaGrid' });
    expect(result.component).toBe('MediaGrid');
  });

  it('rejects unknown source', () => {
    expect(() => uiDismissEventSchema.parse({ source: 'modal' })).toThrow();
  });
});

describe('eventPayloadSchemaMap — covers new event methods', () => {
  it('has entry for event.ui.select', () => {
    expect(eventPayloadSchemaMap['event.ui.select']).toBeDefined();
  });

  it('has entry for event.ui.action', () => {
    expect(eventPayloadSchemaMap['event.ui.action']).toBeDefined();
  });

  it('has entry for event.ui.dismiss', () => {
    expect(eventPayloadSchemaMap['event.ui.dismiss']).toBeDefined();
  });
});
