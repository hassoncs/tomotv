import React from 'react';
import { create, act } from 'react-test-renderer';

import { componentRegistry } from '@/services/componentRegistry';
import '@/components/sdui/registerComponents';

// Mock VideoGridItem to avoid deep native component dependency
jest.mock('@/components/video-grid-item', () => ({
  VideoGridItem: ({ video, onPress, index }: {
    video: { Id: string; Name: string };
    onPress: (v: { Id: string }) => void;
    index: number;
  }) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID={`card-${video.Id}`} onPress={() => onPress(video)}>
        <Text>{video.Name}</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('@/services/jellyfinApi', () => ({
  getPosterUrl: () => 'https://example.com/poster.jpg',
  isFolder: () => false,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/contexts/FolderNavigationContext', () => ({
  useFolderNavigation: () => ({ navigateToFolder: jest.fn() }),
}));

jest.mock('@/contexts/LoadingContext', () => ({
  useLoading: () => ({ showGlobalLoader: jest.fn() }),
}));

jest.mock('@/services/remoteBridgeService', () => ({
  remoteBridgeService: { emitUiSelect: jest.fn() },
}));

jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const makeItem = (id: string, name: string) => ({
  Id: id,
  Name: name,
  RunTimeTicks: 0,
  Type: 'Movie',
  Path: '',
});

describe('MediaGrid component', () => {
  it('is registered in the component registry', () => {
    const manifest = componentRegistry.getManifest();
    expect(manifest.find((c) => c.name === 'MediaGrid')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { MediaGrid } = require('../MediaGrid');
    const items = [makeItem('1', 'Inception'), makeItem('2', 'Interstellar')];
    expect(() =>
      create(<MediaGrid items={items} title="Test" columns={4} onSelectId={undefined} />)
    ).not.toThrow();
  });

  it('fires selection callback with item.Id on press', () => {
    const { MediaGrid } = require('../MediaGrid');
    const onSelect = jest.fn();
    const items = [makeItem('abc123', 'Inception')];

    let instance: ReturnType<typeof create>;
    act(() => {
      instance = create(<MediaGrid items={items} onSelectId={undefined} onSelect={onSelect} />);
    });

    const card = instance!.root.findByProps({ testID: 'card-abc123' });
    act(() => {
      card.props.onPress();
    });

    // onSelect callback is called with the itemId
    expect(onSelect).toHaveBeenCalledWith('abc123');
  });

  it('schema validates JellyfinVideoItem array', () => {
    const { mediaGridPropsSchema } = require('../MediaGrid');
    const result = mediaGridPropsSchema.safeParse({
      items: [makeItem('1', 'Movie A')],
      title: 'My Movies',
      columns: 5,
    });
    expect(result.success).toBe(true);
  });

  it('schema rejects items missing required Id', () => {
    const { mediaGridPropsSchema } = require('../MediaGrid');
    const result = mediaGridPropsSchema.safeParse({
      items: [{ Name: 'No ID', RunTimeTicks: 0, Type: 'Movie', Path: '' }],
    });
    expect(result.success).toBe(false);
  });
});
