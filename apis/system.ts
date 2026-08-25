import { rawRequest } from "./client";

export const systemApi = {
  /**
   * Initialize CSRF protection cookie (Laravel Sanctum)
   */
  initializeCsrf: async (): Promise<void> => {
    await rawRequest("/sanctum/csrf-cookie", { method: "GET" });
  },

  /**
   * Get Captcha configuration/data in JSON format
   */
  getCaptchaApi: async (config?: string): Promise<{ key: string; img: string }> => {
    const res = await rawRequest(config ? `/captcha/api/${config}` : "/captcha/api", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch Captcha api");
    return res.json();
  },

  /**
   * Get URL for direct rendering of CAPTCHA image
   */
  getCaptchaImageSrc: (config?: string): string => {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api$/, "");
    return config ? `${baseUrl}/captcha/${config}?_=${Date.now()}` : `${baseUrl}/captcha?_=${Date.now()}`;
  },

  /**
   * Application health status check
   */
  healthCheck: async (): Promise<{ status: string }> => {
    const res = await rawRequest("/up", { method: "GET" });
    if (!res.ok) return { status: "unhealthy" };
    return { status: "healthy" };
  },

  /**
   * Retrieve public file storage asset url
   */
  getStorageAssetUrl: (path: string): string => {
    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api$/, "");
    return `${baseUrl}/storage/${path.replace(/^\//, "")}`;
  },

  /**
   * Upload/update a storage asset
   */
  uploadStorageAsset: async (path: string, file: File): Promise<Response> => {
    const formData = new FormData();
    formData.append("file", file);
    return rawRequest(`/storage/${path.replace(/^\//, "")}`, {
      method: "PUT",
      body: formData,
    });
  },
};
