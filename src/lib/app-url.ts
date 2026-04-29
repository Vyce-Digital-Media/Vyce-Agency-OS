const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const getAppUrl = () => {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl);
  }

  return trimTrailingSlash(window.location.origin);
};

export const getAuthRedirectUrl = (path = "/reset-password") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppUrl()}${normalizedPath}`;
};