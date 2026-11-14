"""Writes docs/API.md from the running code (backlog item 29), so the documentation can never drift from the endpoints.

    python -m scripts.export_api_docs
"""
from pathlib import Path

from app.main import app

METHODS = ("get", "post", "put", "patch", "delete")


def schema_name(spec: dict | None) -> str:
    if not spec:
        return ""
    ref = spec.get("$ref") or (spec.get("items") or {}).get("$ref")
    if ref:
        name = ref.rsplit("/", 1)[-1]
        return f"list[{name}]" if spec.get("type") == "array" else name
    return spec.get("type", "")


def main() -> None:
    spec = app.openapi()
    by_tag: dict[str, list[str]] = {}
    for path, item in spec["paths"].items():
        for method in METHODS:
            op = item.get(method)
            if not op:
                continue
            tag = (op.get("tags") or ["other"])[0]
            codes = [c for c in op["responses"] if c.startswith("2")]
            ok = codes[0] if codes else "200"
            body = schema_name(((op.get("requestBody") or {}).get("content") or {}).get("application/json", {}).get("schema"))
            out = schema_name(((op["responses"].get(ok) or {}).get("content") or {}).get("application/json", {}).get("schema"))
            params = ", ".join(f"{p['name']}{'' if p.get('required') else '?'}" for p in op.get("parameters", []) if p["in"] in ("query",))
            doc = " ".join((op.get("description") or op.get("summary") or "").split()).replace("|", "/")
            by_tag.setdefault(tag, []).append(
                f"| `{method.upper()}` | `{path}` | {body or '-'} | {ok}{' ' + out if out else ''} | {params or '-'} | {doc[:240]} |")
    lines = [
        "# VolunteerHub API", "",
        "Generated from the code by `python -m scripts.export_api_docs`. Interactive version: `/docs` (Swagger UI) on the running backend.", "",
        "**Authentication.** `POST /auth/login` returns an access token (15 minutes). Send it as `Authorization: Bearer <token>`. "
        "A rotating httpOnly refresh cookie renews it via `POST /auth/refresh`. Roles: `system_admin`, `ngo_admin`, `project_coordinator`, `volunteer`; "
        "NGO endpoints are scoped to the caller's own organisation. Errors are `{\"detail\": \"...\"}` with 400/401/403/404/409/422.", "",
        "**Times** are UTC (ISO 8601). Emails show Asia/Kuala_Lumpur.", "",
    ]
    for tag in sorted(by_tag):
        lines += [f"## {tag}", "", "| Method | Path | Request body | Success | Query | Notes |", "|---|---|---|---|---|---|", *by_tag[tag], ""]
    out = Path(__file__).resolve().parent.parent / "docs" / "API.md"
    out.parent.mkdir(exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {out} ({sum(len(v) for v in by_tag.values())} endpoints)")


if __name__ == "__main__":
    main()
