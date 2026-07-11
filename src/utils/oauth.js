export function isOAuthReturnUrl() {
  const { search, hash } = window.location;
  return (
    search.includes('code=') ||
    hash.includes('access_token') ||
    hash.includes('error=') ||
    search.includes('error=')
  );
}

export function readOAuthErrorFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  const error = hashParams.get('error') || searchParams.get('error');
  const description = hashParams.get('error_description') || searchParams.get('error_description');
  if (!error) return null;
  return description || error;
}

export function clearOAuthParamsFromUrl() {
  if (!window.location.hash && !window.location.search) return;
  window.history.replaceState({}, document.title, window.location.pathname);
}

export function adminOAuthRedirectUrl() {
  return `${window.location.origin}/admin`;
}
