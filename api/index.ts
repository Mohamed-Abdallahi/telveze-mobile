import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

import config from "@/constants/config";

const normalizeNoTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

const resolveDevApiUrl = () => {
  const constantsAny = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    manifest?: { debuggerHost?: string };
    manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
  };

  const rawHost =
    constantsAny.expoConfig?.hostUri ||
    constantsAny.manifest2?.extra?.expoGo?.debuggerHost ||
    constantsAny.manifest?.debuggerHost ||
    "";

  const lanHost = rawHost.split(":")[0];
  if (lanHost) {
    return `http://${lanHost}:3000`;
  }

  return Platform.OS === "android"
    ? "http://10.0.2.2:3000"
    : "http://localhost:3000";
};

const resolvedApiBase = (() => {
  if (envApiUrl) {
    let clean = normalizeNoTrailingSlash(envApiUrl);

    if (__DEV__ && /localhost|127\.0\.0\.1/.test(clean)) {
      const devUrl = normalizeNoTrailingSlash(resolveDevApiUrl());
      clean = clean
        .replace("http://localhost:3000", devUrl)
        .replace("http://127.0.0.1:3000", devUrl)
        .replace("https://localhost:3000", devUrl)
        .replace("https://127.0.0.1:3000", devUrl);
    }

    return clean.endsWith("/api") ? clean : `${clean}/api`;
  }

  if (__DEV__) {
    const devUrl = normalizeNoTrailingSlash(resolveDevApiUrl());
    return devUrl.endsWith("/api") ? devUrl : `${devUrl}/api`;
  }

  return normalizeNoTrailingSlash(config.apiUrl);
})();

export const API_BASE_URL = resolvedApiBase;
export const BASE_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

if (__DEV__) {
  console.log("API_BASE_URL:", API_BASE_URL);
}

export const getApiBaseUrl = (_token?: string) => API_BASE_URL;

const resolveCloudflareStreamUrl = (assetId: string) => {
  const raw = String(assetId || "").trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://videodelivery.net/${raw}/manifest/video.m3u8`;
};

const jwtEncode: (
  payload: Record<string, unknown>,
  secret: string,
  algorithm?: string,
) => string = require("jwt-encode");

const devJwtSecret =
  process.env.EXPO_PUBLIC_JWT_SECRET?.trim() ||
  process.env.EXPO_PUBLIC_DEV_JWT_SECRET?.trim();

const buildDevAccessToken = () => {
  if (!__DEV__ || !devJwtSecret) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: process.env.EXPO_PUBLIC_DEV_USER_ID || "mobile-dev-user",
    email: process.env.EXPO_PUBLIC_DEV_USER_EMAIL || "mobile@telvese.local",
    permissions: ["*"],
    role: process.env.EXPO_PUBLIC_DEV_ROLE || "admin",
    iat: now,
    exp: now + 60 * 60 * 24,
  };

  return jwtEncode(payload, devJwtSecret, "HS256");
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 0,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (requestConfig) => {
  const clerkToken = await AsyncStorage.getItem("__clerk_client_jwt");

  if (clerkToken) {
    requestConfig.headers.Authorization = `Bearer ${clerkToken}`;
    return requestConfig;
  }

  const fallbackToken = await AsyncStorage.getItem("authToken");
  if (fallbackToken) {
    requestConfig.headers.Authorization = `Bearer ${fallbackToken}`;
    return requestConfig;
  }

  const devToken = buildDevAccessToken();
  if (devToken) {
    requestConfig.headers.Authorization = `Bearer ${devToken}`;
  }

  return requestConfig;
});

export type SeriesItem = {
  _id: string;
  title: string;
  description?: string;
  type: "series" | "movie" | "podcast";
  posterUrl?: string;
  trailerAssetId?: string;
  trailerUrl?: string;
  genres?: string[];
  releaseYear?: number;
  isPublished?: boolean;
  seasonCount?: number;
  episodeCount?: number;
};

export type SeasonItem = {
  _id: string;
  contentId: string;
  seasonNumber: number;
  title?: string;
  trailerAssetId?: string;
  trailerUrl?: string;
};

export type EpisodeItem = {
  _id: string;
  contentId: string;
  contentPosterUrl?: string;
  seasonId?: string;
  episodeNumber: number;
  title: string;
  description?: string;
  assetType: "video" | "audio";
  assetId: string;
  trailerAssetId?: string;
  trailerUrl?: string;
  thumbnailUrl?: string;
  isPublished?: boolean;
  season?: {
    _id: string;
    seasonNumber: number;
    title?: string;
  } | null;
  content?: {
    _id: string;
    title?: string;
    posterUrl?: string;
    trailerAssetId?: string;
    trailerUrl?: string;
    type?: "series" | "movie" | "podcast";
  } | null;
};

const toArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const firstNonEmptyArray = <T>(...values: unknown[]): T[] => {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value as T[];
    }
  }

  for (const value of values) {
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
};

const normalizeEpisode = (raw: any): EpisodeItem => {
  const contentRef = raw?.contentId ?? raw?.content;
  const normalizedContentId =
    contentRef && typeof contentRef === "object"
      ? String(contentRef?._id || contentRef?.id || "")
      : String(contentRef || "");

  const seasonIdRef = raw?.seasonId;
  const normalizedSeasonId =
    seasonIdRef && typeof seasonIdRef === "object"
      ? String(seasonIdRef?._id || seasonIdRef?.id || "")
      : seasonIdRef
        ? String(seasonIdRef)
        : undefined;

  const seasonRaw = raw?.season;
  const season = seasonRaw
    ? {
        _id: String(seasonRaw?._id || seasonRaw?.id || ""),
        seasonNumber: Number(seasonRaw?.seasonNumber || 0),
        title: seasonRaw?.title,
      }
    : null;

  const contentRaw =
    contentRef && typeof contentRef === "object" ? contentRef : raw?.content;
  const content = contentRaw
    ? {
        _id: String(contentRaw?._id || contentRaw?.id || ""),
        title: contentRaw?.title,
        posterUrl:
          contentRaw?.posterUrl ||
          contentRaw?.posterURL ||
          contentRaw?.poster ||
          contentRaw?.thumbnailUrl,
        trailerAssetId: contentRaw?.trailerAssetId,
        trailerUrl: contentRaw?.trailerUrl,
        type:
          contentRaw?.type === "movie" || contentRaw?.type === "podcast"
            ? contentRaw.type
            : contentRaw?.type === "series"
              ? "series"
              : undefined,
      }
    : null;

  const contentPosterUrl =
    content?.posterUrl ||
    raw?.contentPosterUrl ||
    raw?.contentImageUrl ||
    (raw?.content && raw.content?.posterUrl) ||
    undefined;

  return {
    _id: String(raw?._id || raw?.id || ""),
    contentId: normalizedContentId,
    contentPosterUrl:
      typeof contentPosterUrl === "string" && contentPosterUrl.trim().length > 0
        ? contentPosterUrl.trim()
        : undefined,
    seasonId: normalizedSeasonId,
    episodeNumber: Number(raw?.episodeNumber || 0),
    title: String(raw?.title || "Untitled"),
    description: raw?.description,
    assetType: raw?.assetType === "audio" ? "audio" : "video",
    assetId: String(raw?.assetId || ""),
    trailerAssetId: raw?.trailerAssetId,
    trailerUrl: raw?.trailerUrl,
    thumbnailUrl: raw?.thumbnailUrl,
    isPublished: raw?.isPublished,
    season,
    content,
  };
};

const normalizeSeries = (raw: any): SeriesItem | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = String(raw?._id || raw?.id || "").trim();
  if (!id) {
    return null;
  }

  const typeRaw = String(raw?.type || "series").toLowerCase();
  const type: SeriesItem["type"] =
    typeRaw === "movie" || typeRaw === "podcast" ? (typeRaw as any) : "series";

  return {
    _id: id,
    title: String(raw?.title || raw?.name || "Series"),
    description: raw?.description,
    type,
    posterUrl: raw?.posterUrl || raw?.posterURL || raw?.poster || raw?.thumbnailUrl,
    trailerAssetId: raw?.trailerAssetId,
    trailerUrl: raw?.trailerUrl,
    genres: Array.isArray(raw?.genres) ? raw.genres : undefined,
    releaseYear:
      typeof raw?.releaseYear === "number" ? raw.releaseYear : undefined,
    isPublished:
      typeof raw?.isPublished === "boolean" ? raw.isPublished : undefined,
    seasonCount:
      typeof raw?.seasonCount === "number" ? raw.seasonCount : undefined,
    episodeCount:
      typeof raw?.episodeCount === "number" ? raw.episodeCount : undefined,
  };
};

const extractEpisodesFromPayload = (payload: any): EpisodeItem[] => {
  const rawEpisodes = firstNonEmptyArray<any>(
    payload,
    payload?.data,
    payload?.data?.episodes,
    payload?.episodes,
  );

  return rawEpisodes
    .map(normalizeEpisode)
    .filter((episode) => Boolean(episode._id));
};

const extractSeasonsFromPayload = (payload: any): SeasonItem[] => {
  const rawSeasons = firstNonEmptyArray<any>(
    payload,
    payload?.data,
    payload?.data?.seasons,
    payload?.seasons,
  );

  return rawSeasons
    .map((raw) => ({
      _id: String(raw?._id || raw?.id || ""),
      contentId: String(raw?.contentId || raw?.content || ""),
      seasonNumber: Number(raw?.seasonNumber || 0),
      title: raw?.title,
      trailerAssetId: raw?.trailerAssetId,
      trailerUrl: raw?.trailerUrl,
    }))
    .filter((season) => Boolean(season._id));
};

type NormalizedWatchProgress = {
  lastWatchedSecond: number;
  videoDuration: number;
  completed: boolean;
};

const normalizeWatchProgress = (payload: any): NormalizedWatchProgress => {
  const source = payload?.progress || payload?.data || payload || {};

  const watchedCandidates = [
    source?.lastWatchedSecond,
    source?.currentSecond,
    source?.progressInSeconds,
    source?.position,
    source?.watchedSeconds,
  ];
  const durationCandidates = [
    source?.videoDuration,
    source?.duration,
    source?.durationInSeconds,
    source?.totalDuration,
  ];

  const watched = watchedCandidates.find(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  const duration = durationCandidates.find(
    (value) => typeof value === "number" && Number.isFinite(value),
  );

  return {
    lastWatchedSecond: Math.max(0, watched || 0),
    videoDuration: Math.max(0, duration || 0),
    completed: Boolean(source?.completed),
  };
};

export const videosAPI = {
  listSeries: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
    genre?: string;
    year?: string;
    publishedOnly?: boolean;
    _ts?: number;
  }) => {
    const {
      search = "",
      page = 1,
      limit = 20,
      genre,
      year,
      publishedOnly = true,
      _ts,
    } = params || {};

    const response = await api.get("/admin/series", {
      params: { search, page, limit, _ts },
    });

    const payload = response.data;
    if (
      typeof payload === "string" &&
      payload.toLowerCase().includes("<html")
    ) {
      throw new Error(
        "Series endpoint returned HTML instead of JSON. This usually means auth redirect or wrong API URL.",
      );
    }

    if (!payload || !Array.isArray(payload?.data)) {
      throw new Error(payload?.message || "Invalid series API response.");
    }

    const list: SeriesItem[] = payload?.data || [];

    const filtered = list.filter((item) => {
      if (publishedOnly && item.isPublished === false) {
        return false;
      }

      if (
        genre &&
        !(item.genres || []).some(
          (entry) => entry.toLowerCase() === genre.toLowerCase(),
        )
      ) {
        return false;
      }

      if (year && String(item.releaseYear || "") !== String(year)) {
        return false;
      }

      return true;
    });

    return {
      success: Boolean(payload?.success),
      data: filtered,
      meta: payload?.meta,
    };
  },

  getSeriesSeasons: async (seriesId: string) => {
    const response = await api.get(`/admin/series/${seriesId}/seasons`);
    const payload = response.data;
    const seasons = extractSeasonsFromPayload(payload);

    return {
      success: Boolean(payload?.success),
      data: seasons,
      count: payload?.count || seasons.length,
    };
  },

  getSeriesById: async (seriesId: string, params?: { _ts?: number }) => {
    const response = await api.get(`/admin/series/${seriesId}`, {
      params,
    });
    const payload = response.data;
    const source = payload?.data && typeof payload.data === "object"
      ? payload.data
      : payload;
    const series = normalizeSeries(source);

    return {
      success: Boolean(payload?.success),
      data: series,
    };
  },

  listEpisodes: async (params: {
    contentId: string;
    seasonId?: string;
    search?: string;
    page?: number;
    limit?: number;
    _ts?: number;
  }) => {
    const {
      contentId,
      seasonId,
      search,
      page,
      limit,
      _ts,
    } = params;

    const baseParams = {
      seasonId,
      search,
      page,
      limit,
      _ts,
    };

    const candidates = [
      { ...baseParams, contentId },
      { ...baseParams, seriesId: contentId },
      { ...baseParams, content: contentId },
    ];

    let payload: any = null;
    let parsed: EpisodeItem[] = [];
    let lastError: unknown = null;

    for (const candidateParams of candidates) {
      try {
        const response = await api.get("/admin/episodes", {
          params: candidateParams,
        });
        payload = response.data;
        parsed = extractEpisodesFromPayload(payload);

        if (parsed.length > 0) {
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (!payload && lastError) {
      throw lastError;
    }

    return {
      success: Boolean(payload?.success),
      data: parsed,
      meta: payload?.meta,
    };
  },

  getEpisodeById: async (episodeId: string) => {
    const response = await api.get(`/admin/episodes/${episodeId}`);
    const payload = response.data;

    return {
      success: Boolean(payload?.success),
      data: (payload?.data || null) as EpisodeItem | null,
    };
  },

  getVideos: async (params?: {
    category?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }) => {
    const response = await api.get("/videos", { params });
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get("/categories");
    return response.data;
  },

  getStreamUrl: async (videoId: string) => {
    try {
      const response = await api.get("/stream", { params: { videoId } });
      const payload = response.data;
      if (payload?.streamUrl) {
        return payload;
      }
    } catch {
      // Fallback below for deployments without /stream endpoint.
    }

    const streamUrl = resolveCloudflareStreamUrl(videoId);
    if (!streamUrl) {
      throw new Error("Unable to resolve stream URL for this video.");
    }

    return {
      success: true,
      streamUrl,
    };
  },

  getWatchProgress: async (videoId: string) => {
    const response = await api.get("/watch-progress", { params: { videoId } });
    const progress = normalizeWatchProgress(response.data);

    return {
      success:
        typeof response.data?.success === "boolean"
          ? response.data.success
          : true,
      progress,
      raw: response.data,
    };
  },

  saveWatchProgress: async (
    videoId: string,
    currentSecond: number,
    videoDuration: number,
  ) => {
    const response = await api.post("/watch-progress", {
      videoId,
      episodeId: videoId,
      currentSecond,
      lastWatchedSecond: currentSecond,
      progressInSeconds: currentSecond,
      videoDuration,
      duration: videoDuration,
      completed:
        videoDuration > 0
          ? currentSecond / Math.max(videoDuration, 1) >= 0.95
          : false,
    });

    return response.data;
  },

  getContinueWatching: async () => {
    const userId = await AsyncStorage.getItem("userId");
    const response = await api.get("/continue-watching", {
      params: { userId },
    });
    return response.data;
  },

  getSubscriptionStatus: async () => {
    const response = await api.get("/subscriptions/status");
    return response.data;
  },
};

export default api;
