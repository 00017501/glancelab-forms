import type {
  FormContent,
  FormDetail,
  FormSummary,
  ImageLibrary,
  ResponseList,
  UploadOutcome,
} from "./types";

/** An error the server answered with. `details` lists what is missing when a study cannot be published. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];

  constructor(status: number, code: string, message: string, details: string[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onSignedOut: () => void = () => {};

/** Called whenever the server says the admin session is missing or expired. */
export function watchSignedOut(listener: () => void): void {
  onSignedOut = listener;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined || isForm ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "offline", "Could not reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
      details?: string[];
    };
    if (response.status === 401 && error.code === "not_authenticated") onSignedOut();
    throw new ApiError(
      response.status,
      error.code ?? "error",
      error.message ?? "Something went wrong. Please try again.",
      error.details ?? [],
    );
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  me: () => request<{ username: string }>("GET", "/api/admin/me"),
  login: (username: string, password: string) =>
    request<{ username: string }>("POST", "/api/admin/login", { username, password }),
  logout: () => request<undefined>("POST", "/api/admin/logout"),

  listForms: () => request<FormSummary[]>("GET", "/api/admin/forms"),
  createForm: (title: string) => request<FormDetail>("POST", "/api/admin/forms", { title }),
  getForm: (id: number) => request<FormDetail>("GET", `/api/admin/forms/${id}`),
  saveForm: (id: number, content: FormContent) => request<FormDetail>("PUT", `/api/admin/forms/${id}`, content),
  deleteForm: (id: number) => request<undefined>("DELETE", `/api/admin/forms/${id}`),
  duplicateForm: (id: number) => request<FormDetail>("POST", `/api/admin/forms/${id}/duplicate`),
  publishForm: (id: number) => request<FormDetail>("POST", `/api/admin/forms/${id}/publish`),
  closeForm: (id: number) => request<FormDetail>("POST", `/api/admin/forms/${id}/close`),

  listImages: () => request<ImageLibrary>("GET", "/api/admin/images"),
  uploadImages: (files: File[]) => {
    const data = new FormData();
    for (const file of files) data.append("files", file);
    return request<UploadOutcome>("POST", "/api/admin/images", data);
  },
  deleteImage: (id: number) => request<undefined>("DELETE", `/api/admin/images/${id}`),

  listResponses: (formId: number) => request<ResponseList>("GET", `/api/admin/forms/${formId}/responses`),
  clearResponses: (formId: number) =>
    request<{ deleted: number }>("DELETE", `/api/admin/forms/${formId}/responses`),
  deleteResponse: (formId: number, participantId: string) =>
    request<{ deleted: number }>(
      "DELETE",
      `/api/admin/forms/${formId}/responses/${encodeURIComponent(participantId)}`,
    ),
  wipe: (confirmation: string, includeFormsAndImages: boolean) =>
    request<{ deleted: number }>("POST", "/api/admin/wipe", {
      confirmation,
      include_forms_and_images: includeFormsAndImages,
    }),
};

export const responsesCsvUrl = (formId: number): string => `/api/admin/forms/${formId}/responses.csv`;
export const codebookCsvUrl = (formId: number): string => `/api/admin/forms/${formId}/codebook.csv`;
