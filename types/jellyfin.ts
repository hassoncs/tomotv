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
  CommunityRating?: number;
  OfficialRating?: string;
  Genres?: string[];
  ImageTags?: {
    Primary?: string;
  };
}

export interface JellyfinVideosResponse {
  Items: JellyfinVideoItem[];
  TotalRecordCount: number;
  StartIndex: number;
}
