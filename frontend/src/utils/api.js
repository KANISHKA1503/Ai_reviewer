const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchReviews(limit = 50, offset = 0) {
  const res = await fetch(`${API_BASE}/reviews?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json();
}

export async function fetchReview(id) {
  const res = await fetch(`${API_BASE}/reviews/${id}`);
  if (!res.ok) throw new Error('Failed to fetch review');
  return res.json();
}

export async function fetchEvents() {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function triggerReview(prUrl) {
  const res = await fetch(`${API_BASE}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pr_url: prUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to trigger review');
  }
  return res.json();
}
