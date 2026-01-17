export interface JellyfinMediaStream {
  Codec: string;
  Type: string;
  Width?: number;
  Height?: number;
  BitRate?: number;
  DisplayTitle?: string;
  Index?: number;
  IsExternal?: boolean;
  Language?: string;
}

export interface JellyfinVideoItem {
  Name: string;
  Id: string;
  RunTimeTicks: number;
  Type: string;
  Path: string;
  MediaStreams?: JellyfinMediaStream[];
  Overview?: string;
  PremiereDate?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  Genres?: string[];
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ImageTags?: {
    Primary?: string;
  };
}

export interface JellyfinVideosResponse {
  Items: JellyfinVideoItem[];
  TotalRecordCount: number;
  StartIndex: number;
}

// Extended item type that includes folder-specific fields
export interface JellyfinItem extends JellyfinVideoItem {
  ParentId?: string;
  ChildCount?: number;
  CollectionType?: string;
}

// Navigation stack entry for breadcrumb
export interface FolderStackEntry {
  id: string;
  name: string;
  parentId?: string;
}

// API response for folder contents
export interface JellyfinFolderResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
  StartIndex: number;
}
