"""Staging smoke test (backlog item 30): is the backend reachable over HTTPS, and does CORS + the cookie work for the
Vercel frontend?

    python -m scripts.smoke_staging --url https://your-machine.tailnet.ts.net --origin https://cos-40005-fyp-1.vercel.app
    python -m scripts.smoke_staging --url ... --origin ... --email you@example.com --password '...'   (also checks login cookie)

Exit code 0 = all checks passed. Nothing is changed on the server (login only creates a refresh-token row).
"""
import argparse
import sys

import httpx


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True, help="backend base URL, e.g. the Tailscale Funnel URL")
    ap.add_argument("--origin", required=True, help="frontend origin, e.g. the Vercel URL")
    ap.add_argument("--email")
    ap.add_argument("--password")
    a = ap.parse_args()
    base, results = a.url.rstrip("/"), []

    def check(name: str, ok: bool, detail: str = "") -> None:
        results.append(ok)
        print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"  ({detail})" if detail else ""))

    check("URL uses HTTPS", base.startswith("https://"))
    with httpx.Client(timeout=15) as c:
        try:
            r = c.get(f"{base}/health")
            check("GET /health answers 200", r.status_code == 200 and r.json().get("ok") is True, f"HTTP {r.status_code}")
        except httpx.HTTPError as e:
            check("GET /health answers 200", False, e.__class__.__name__)
            return 1
        pre = c.options(f"{base}/auth/login", headers={"Origin": a.origin, "Access-Control-Request-Method": "POST",
                                                       "Access-Control-Request-Headers": "content-type,authorization"})
        check("CORS preflight allows the frontend origin", pre.headers.get("access-control-allow-origin") == a.origin,
              f"got {pre.headers.get('access-control-allow-origin')!r}")
        check("CORS allows credentials (needed for the refresh cookie)", pre.headers.get("access-control-allow-credentials") == "true")
        bad = c.options(f"{base}/auth/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
        check("CORS refuses an unknown origin", bad.headers.get("access-control-allow-origin") is None)
        check("API docs are reachable", c.get(f"{base}/openapi.json").status_code == 200)
        if a.email and a.password:
            r = c.post(f"{base}/auth/login", json={"email": a.email, "password": a.password}, headers={"Origin": a.origin})
            check("login works", r.status_code == 200, f"HTTP {r.status_code}")
            cookie = r.headers.get("set-cookie", "")
            low = cookie.lower()
            check("refresh cookie is HttpOnly", "httponly" in low)
            check("refresh cookie is Secure", "secure" in low)
            check("refresh cookie SameSite is lax or none", "samesite=lax" in low or "samesite=none" in low, cookie.split(";")[-1] if cookie else "no cookie")
    print(f"\n{sum(results)}/{len(results)} checks passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
