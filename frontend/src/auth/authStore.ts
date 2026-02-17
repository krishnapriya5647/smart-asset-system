export type Tokens = { access: string; refresh: string };

const KEY = "auth_tokens";

export const tokenStore = {
  get(): Tokens | null {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  },
  set(tokens: Tokens) {
    localStorage.setItem(KEY, JSON.stringify(tokens));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
