import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";

import { api } from "./client";
import type { FormDetail, FormSummary, ImageLibrary, LibraryImage, ResponseList } from "./types";

export const keys = {
  me: ["me"] as const,
  forms: ["forms"] as const,
  form: (id: number) => ["forms", id] as const,
  images: ["images"] as const,
  responses: (id: number) => ["forms", id, "responses"] as const,
};

export function useMe(): UseQueryResult<{ username: string }> {
  return useQuery({ queryKey: keys.me, queryFn: api.me, retry: false, staleTime: 60_000 });
}

export function useForms(): UseQueryResult<FormSummary[]> {
  return useQuery({ queryKey: keys.forms, queryFn: api.listForms });
}

export function useForm(id: number): UseQueryResult<FormDetail> {
  return useQuery({ queryKey: keys.form(id), queryFn: () => api.getForm(id) });
}

export function useImages(): UseQueryResult<ImageLibrary> {
  return useQuery({ queryKey: keys.images, queryFn: api.listImages });
}

/** Look up library images by id; empty until the library has loaded. */
export function useImageMap(): Map<number, LibraryImage> {
  const { data } = useImages();
  return new Map((data?.images ?? []).map((image) => [image.id, image]));
}

// Responses arrive while the admin watches; refresh without her having to reload.
const RESPONSES_REFRESH_MS = 10_000;

export function useResponses(id: number): UseQueryResult<ResponseList> {
  return useQuery({
    queryKey: keys.responses(id),
    queryFn: () => api.listResponses(id),
    refetchInterval: RESPONSES_REFRESH_MS,
  });
}

/** Refresh everything that depends on the image library after an upload or delete. */
export function useRefreshImages(): () => Promise<void> {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: keys.images });
}
