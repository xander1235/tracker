// Default to same-origin for single-server setup. Override with VITE_API_URL if needed.
export const API_URL = (import.meta as any).env?.VITE_API_URL ?? ''

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.error) msg = data.error
    } catch {}
    throw new Error(msg)
  }
  try {
    return (await res.json()) as T
  } catch {
    // no body
    return undefined as unknown as T
  }
}

export const api = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, { method: 'GET', credentials: 'omit' })
    return handle<T>(res)
  },
  post: async <T>(path: string, body?: any): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
    })
    return handle<T>(res)
  },
  put: async <T>(path: string, body?: any): Promise<T> => {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'omit',
    })
    return handle<T>(res)
  },
}
