import { z } from 'zod';

import type { BridgeEventMethod, BridgeRequestMethod, FullAppState, LibraryState, NavigationState, PlaybackState, QueueState } from '@/bridge/types';

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type JsonPrimitive = z.infer<typeof jsonPrimitiveSchema>;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

export const jsonRpcVersionSchema = z.literal('2.0');

export const playbackPlayParamsSchema = z.object({
  jellyfinId: z.string().min(1),
  folderId: z.string().min(1).optional()
});

export const playbackSeekParamsSchema = z.object({
  position: z.number().finite().nonnegative()
});

export const navigationPushParamsSchema = z.object({
  route: z.string().min(1),
  params: z.record(z.string(), z.string()).optional()
});

export const remoteKeyParamsSchema = z.object({
  key: z.enum(['up', 'down', 'left', 'right', 'select', 'menu', 'play_pause']),
  action: z.enum(['tap', 'hold']).optional()
});

export const inputTextParamsSchema = z.object({
  text: z.string()
});

export const uiRenderParamsSchema = z.object({
  component: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional().default({})
});

const noParamsSchema = z.undefined();

export const methodParamsSchemaMap = {
  'playback.play': playbackPlayParamsSchema,
  'playback.pause': noParamsSchema,
  'playback.resume': noParamsSchema,
  'playback.stop': noParamsSchema,
  'playback.seek': playbackSeekParamsSchema,
  'playback.next': noParamsSchema,
  'playback.prev': noParamsSchema,
  'state.status': noParamsSchema,
  'state.queue': noParamsSchema,
  'state.library': noParamsSchema,
  'navigation.push': navigationPushParamsSchema,
  'navigation.back': noParamsSchema,
  'navigation.getCurrentRoute': noParamsSchema,
  'remote.key': remoteKeyParamsSchema,
  'input.text': inputTextParamsSchema,
  'input.clear': noParamsSchema,
  'ui.render': uiRenderParamsSchema,
  'ui.components': noParamsSchema
} satisfies Record<BridgeRequestMethod, z.ZodType<unknown>>;

export const bridgeRequestMethodSchema = z.enum([
  'playback.play',
  'playback.pause',
  'playback.resume',
  'playback.stop',
  'playback.seek',
  'playback.next',
  'playback.prev',
  'state.status',
  'state.queue',
  'state.library',
  'navigation.push',
  'navigation.back',
  'navigation.getCurrentRoute',
  'remote.key',
  'input.text',
  'input.clear',
  'ui.render',
  'ui.components'
]);

export const bridgeEventMethodSchema = z.enum([
  'event.playback',
  'event.navigation',
  'event.queue'
]);

const jsonRpcIdSchema = z.union([z.string(), z.number(), z.null()]);

export const jsonRpcRequestSchema = z.object({
  jsonrpc: jsonRpcVersionSchema,
  id: jsonRpcIdSchema,
  method: bridgeRequestMethodSchema,
  params: jsonValueSchema.optional()
});

export const jsonRpcNotificationSchema = z.object({
  jsonrpc: jsonRpcVersionSchema,
  method: bridgeRequestMethodSchema,
  params: jsonValueSchema.optional()
});

const jsonRpcErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: jsonValueSchema.optional()
});

export const jsonRpcSuccessResponseSchema = z.object({
  jsonrpc: jsonRpcVersionSchema,
  id: jsonRpcIdSchema,
  result: jsonValueSchema
});

export const jsonRpcErrorResponseSchema = z.object({
  jsonrpc: jsonRpcVersionSchema,
  id: jsonRpcIdSchema,
  error: jsonRpcErrorSchema
});

export const jsonRpcResponseSchema = z.union([
  jsonRpcSuccessResponseSchema,
  jsonRpcErrorResponseSchema
]);

export const jsonRpcInboundMessageSchema = z.union([
  jsonRpcRequestSchema,
  jsonRpcNotificationSchema
]);

export const playbackStateSchema = z.object({
  status: z.enum(['idle', 'playing', 'paused', 'stopped', 'buffering', 'error']),
  jellyfinId: z.string().nullable(),
  positionSeconds: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
  playerRegistered: z.boolean()
}) satisfies z.ZodType<PlaybackState>;

const mediaStreamSchema = z.object({
  Codec: z.string(),
  Type: z.string(),
  Width: z.number().optional(),
  Height: z.number().optional(),
  BitRate: z.number().optional(),
  DisplayTitle: z.string().optional(),
  Index: z.number().optional(),
  IsExternal: z.boolean().optional(),
  Language: z.string().optional(),
  Channels: z.number().optional(),
  ChannelLayout: z.string().optional(),
  IsDefault: z.boolean().optional(),
  IsForced: z.boolean().optional()
});

const mediaSourceSchema = z.object({
  Id: z.string(),
  Name: z.string().optional(),
  Path: z.string().optional(),
  Protocol: z.string().optional(),
  Container: z.string().optional(),
  MediaStreams: z.array(mediaStreamSchema).optional()
});

const queueItemSchema = z.object({
  Name: z.string(),
  Id: z.string(),
  RunTimeTicks: z.number(),
  Type: z.string(),
  Path: z.string(),
  MediaStreams: z.array(mediaStreamSchema).optional(),
  MediaSources: z.array(mediaSourceSchema).optional(),
  Overview: z.string().optional(),
  PremiereDate: z.string().optional(),
  ProductionYear: z.number().optional(),
  CommunityRating: z.number().optional(),
  OfficialRating: z.string().optional(),
  Genres: z.array(z.string()).optional(),
  SeriesName: z.string().optional(),
  SeasonName: z.string().optional(),
  IndexNumber: z.number().optional(),
  ParentIndexNumber: z.number().optional(),
  ImageTags: z.object({
    Primary: z.string().optional()
  }).optional(),
  PrimaryImageAspectRatio: z.number().optional()
});

export const queueStateSchema = z.object({
  queue: z.array(queueItemSchema),
  currentIndex: z.number().int(),
  isLoading: z.boolean(),
  sourceFolderId: z.string().nullable()
}) satisfies z.ZodType<QueueState>;

export const libraryStateSchema = z.object({
  videos: z.array(queueItemSchema),
  isLoading: z.boolean(),
  isLoadingMore: z.boolean(),
  hasMoreResults: z.boolean(),
  error: z.string().nullable(),
  libraryName: z.string()
}) satisfies z.ZodType<LibraryState>;

export const navigationStateSchema = z.object({
  route: z.string(),
  params: z.record(z.string(), z.string())
}) satisfies z.ZodType<NavigationState>;

export const fullAppStateSchema = z.object({
  navigation: navigationStateSchema,
  playback: playbackStateSchema,
  queue: queueStateSchema,
  library: libraryStateSchema
}) satisfies z.ZodType<FullAppState>;

export const eventPayloadSchemaMap = {
  'event.playback': playbackStateSchema,
  'event.navigation': navigationStateSchema,
  'event.queue': queueStateSchema
} satisfies Record<BridgeEventMethod, z.ZodType<unknown>>;

export const jsonRpcEventNotificationSchema = z.object({
  jsonrpc: jsonRpcVersionSchema,
  method: bridgeEventMethodSchema,
  params: jsonValueSchema
});

export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;
export type JsonRpcInboundMessage = z.infer<typeof jsonRpcInboundMessageSchema>;
export type JsonRpcSuccessResponse = z.infer<typeof jsonRpcSuccessResponseSchema>;
export type JsonRpcErrorResponse = z.infer<typeof jsonRpcErrorResponseSchema>;
export type JsonRpcResponse = z.infer<typeof jsonRpcResponseSchema>;
export type JsonRpcEventNotification = z.infer<typeof jsonRpcEventNotificationSchema>;
