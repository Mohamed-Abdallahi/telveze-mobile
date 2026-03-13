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
  timeout: 10000,
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
};

export type EpisodeItem = {
  _id: string;
  contentId: string;
  seasonId?: string;
  episodeNumber: number;
  title: string;
  description?: string;
  assetType: "video" | "audio";
  assetId: string;
  thumbnailUrl?: string;
  isPublished?: boolean;
  season?: {
    _id: string;
    seasonNumber: number;
    title?: string;
  } | null;
};

export const videosAPI = {
  listSeries: async (params?: {
    search?: string;
    page?: number;
    limit?: number;
    genre?: string;
    year?: string;
    publishedOnly?: boolean;
  }) => {
    const {
      search = "",
      page = 1,
      limit = 20,
      genre,
      year,
      publishedOnly = true,
    } = params || {};

    const response = await api.get("/admin/series", {
      params: { search, page, limit },
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

    return {
      success: Boolean(payload?.success),
      data: (payload?.data || []) as SeasonItem[],
      count: payload?.count || 0,
    };
  },

  listEpisodes: async (params: {
    contentId: string;
    seasonId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get("/admin/episodes", { params });
    const payload = response.data;

    return {
      success: Boolean(payload?.success),
      data: (payload?.data || []) as EpisodeItem[],
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
    return response.data;
  },

  saveWatchProgress: async (
    videoId: string,
    currentSecond: number,
    videoDuration: number,
  ) => {
    const response = await api.post("/watch-progress", {
      videoId,
      currentSecond,
      videoDuration,
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
