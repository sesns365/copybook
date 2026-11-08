export class ResponseFormatError extends Error {
  status: number;
  redirected: boolean;
  constructor(response: Response, message: string) {
    super(message);
    this.name = 'ResponseFormatError';
    this.status = response.status;
    this.redirected = response.redirected;
  }
}

export async function readJSON(response: Response, message = '資料暫時無法載入，請保留目前畫面後重試。') {
  const contentType = response.headers.get('content-type') || '';
  if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(contentType)) {
    throw new ResponseFormatError(response, response.redirected
      ? '登入狀態可能已失效，請保留尚未儲存的內容，重新登入後再試。'
      : message);
  }
  let data: any;
  try { data = await response.json(); }
  catch { throw new ResponseFormatError(response, message); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ResponseFormatError(response, message);
  if (!response.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : message) as Error & {response?: any};
    error.response = data;
    throw error;
  }
  return data;
}

export async function fetchJSON(url: string, init: RequestInit = {}, message?: string) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const method = (init.method || 'GET').toUpperCase();
  // Retry only a read that received an invalid response. Never replay a write.
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      const requestURL = attempt ? url + (url.includes('?') ? '&' : '?') + '_dataRetry=' + Date.now() : url;
      response = await fetch(requestURL, {...init, headers, cache: 'no-store'});
    } catch { throw new Error('連線中斷，請保留目前畫面，確認網路後重試。'); }
    try { return await readJSON(response, message); }
    catch (error) {
      if (method === 'GET' && attempt === 0 && error instanceof ResponseFormatError && !error.redirected && [200, 502, 503, 504].includes(error.status)) continue;
      throw error;
    }
  }
}
