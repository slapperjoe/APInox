/**
 * Native HTTP client using Node.js built-in fetch API (Node 18+)
 * Replacement for axios to enable standalone binary builds
 */

export interface HttpClientOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: string;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: HttpResponse
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class HttpTimeoutError extends HttpError {
  constructor(timeout: number) {
    super(`Request timeout after ${timeout}ms`);
    this.name = 'HttpTimeoutError';
  }
}

/**
 * Make an HTTP request using native fetch API
 */
export async function request(
  url: string,
  options: HttpClientOptions
): Promise<HttpResponse> {
  const controller = new AbortController();
  const timeout = options.timeout || 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    const data = await response.text();

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const result: HttpResponse = {
      status: response.status,
      statusText: response.statusText,
      headers,
      data,
    };

    if (!response.ok) {
      throw new HttpError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        result
      );
    }

    return result;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new HttpTimeoutError(timeout);
      }
      throw new HttpError(error.message);
    }

    throw new HttpError('Unknown error occurred');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export async function get(
  url: string,
  options: Omit<HttpClientOptions, 'method' | 'body'> = {}
): Promise<HttpResponse> {
  return request(url, { ...options, method: 'GET' });
}

export async function post(
  url: string,
  body: string,
  options: Omit<HttpClientOptions, 'method' | 'body'> = {}
): Promise<HttpResponse> {
  return request(url, { ...options, method: 'POST', body });
}

export async function put(
  url: string,
  body: string,
  options: Omit<HttpClientOptions, 'method' | 'body'> = {}
): Promise<HttpResponse> {
  return request(url, { ...options, method: 'PUT', body });
}

export async function patch(
  url: string,
  body: string,
  options: Omit<HttpClientOptions, 'method' | 'body'> = {}
): Promise<HttpResponse> {
  return request(url, { ...options, method: 'PATCH', body });
}

export async function del(
  url: string,
  options: Omit<HttpClientOptions, 'method' | 'body'> = {}
): Promise<HttpResponse> {
  return request(url, { ...options, method: 'DELETE' });
}
