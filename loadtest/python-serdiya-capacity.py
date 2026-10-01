#!/usr/bin/env python3
"""Read-only capacity tester for serdiyajewellers.com and its staging clone.

Production is permanently restricted to low-rate baseline/canary profiles.
Heavy ramp, spike, and soak profiles require an explicit non-production staging
hostname. Only public catalog GET requests are issued.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import statistics
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

PRODUCTION_HOSTS = {"serdiyajewellers.com", "www.serdiyajewellers.com"}
ALLOWED_PREFIXES = ("/product/", "/category/")
BLOCKED_PREFIXES = (
    "/admin", "/account", "/cart", "/checkout", "/login", "/api/",
    "/payment", "/orders", "/webhook",
)
USER_AGENT = "serdiya-capacity-canary/1.0 (owner-authorized; read-only)"
TIMEOUT_SECONDS = 10.0
MAX_CONSECUTIVE_5XX = 3

PROFILES = {
    "baseline": [(1, 0.5, 12)],
    "canary": [(2, 1.0, 30)],
    "ramp": [(5, 3, 60), (10, 6, 90), (25, 15, 120), (50, 30, 120), (100, 60, 120)],
    "spike": [(10, 5, 20), (75, 60, 45), (10, 5, 20)],
    "soak": [(25, 12, 1800)],
}


@dataclass
class Result:
    stage: int
    path: str
    status: int
    ok: bool
    ttfb_ms: float
    total_ms: float
    bytes: int
    cf_cache_status: str
    render_id: str
    error: str
    started_at: str


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(0, min(len(ordered) - 1, math.ceil(pct * len(ordered)) - 1))
    return ordered[rank]


def host_of(url: str) -> str:
    return (urllib.parse.urlparse(url).hostname or "").lower().rstrip(".")


def is_production(url: str) -> bool:
    host = host_of(url)
    return host in PRODUCTION_HOSTS or any(host.endswith("." + item) for item in PRODUCTION_HOSTS)


def safe_path(path: str) -> bool:
    parsed = urllib.parse.urlparse(path)
    clean = parsed.path or "/"
    if parsed.scheme or parsed.netloc or any(clean.startswith(prefix) for prefix in BLOCKED_PREFIXES):
        return False
    return clean == "/" or any(clean.startswith(prefix) for prefix in ALLOWED_PREFIXES)


def open_get(url: str):
    request = urllib.request.Request(
        url,
        method="GET",
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    )
    return urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS)


def discover_paths(base_url: str, limit: int = 100) -> list[str]:
    paths = ["/"]
    sitemap_url = base_url.rstrip("/") + "/sitemap.xml"
    try:
        with open_get(sitemap_url) as response:
            body = response.read(2_000_000)
        root = ET.fromstring(body)
        for node in root.iter():
            if not node.tag.endswith("loc") or not node.text:
                continue
            parsed = urllib.parse.urlparse(node.text.strip())
            if parsed.hostname and parsed.hostname.lower() != host_of(base_url):
                continue
            path = parsed.path or "/"
            if safe_path(path) and path not in paths:
                paths.append(path)
            if len(paths) >= limit:
                break
    except (urllib.error.URLError, TimeoutError, ET.ParseError, ValueError) as exc:
        print(f"Warning: sitemap discovery failed; testing homepage only: {exc}", file=sys.stderr)
    return paths


def fetch(base_url: str, path: str, stage: int) -> Result:
    started = datetime.now(timezone.utc).isoformat()
    begin = time.perf_counter()
    status = 0
    headers = {}
    body = b""
    error = ""
    try:
        encoded_path = urllib.parse.quote(path, safe="/%:@-._~!$&'()*+,;=")
        with open_get(base_url.rstrip("/") + encoded_path) as response:
            headers = dict(response.headers.items())
            ttfb = (time.perf_counter() - begin) * 1000
            body = response.read(2_000_000)
            status = response.status
    except urllib.error.HTTPError as exc:
        ttfb = (time.perf_counter() - begin) * 1000
        status = exc.code
        headers = dict(exc.headers.items()) if exc.headers else {}
        error = f"HTTP {exc.code}"
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        ttfb = (time.perf_counter() - begin) * 1000
        error = str(exc)[:240]
    total = (time.perf_counter() - begin) * 1000
    lower = {key.lower(): value for key, value in headers.items()}
    return Result(
        stage=stage,
        path=path,
        status=status,
        ok=200 <= status < 400,
        ttfb_ms=round(ttfb, 2),
        total_ms=round(total, 2),
        bytes=len(body),
        cf_cache_status=lower.get("cf-cache-status", ""),
        render_id=lower.get("rndr-id", ""),
        error=error,
        started_at=started,
    )


def stage_summary(results: list[Result], elapsed: float) -> dict:
    totals = [item.total_ms for item in results]
    ttfbs = [item.ttfb_ms for item in results]
    failures = [item for item in results if not item.ok]
    cache_hits = [item for item in results if item.cf_cache_status.upper() == "HIT"]
    return {
        "requests": len(results),
        "errors": len(failures),
        "error_rate": len(failures) / len(results) if results else 0,
        "rps": len(results) / elapsed if elapsed else 0,
        "p50_ms": percentile(totals, 0.50),
        "p95_ms": percentile(totals, 0.95),
        "p99_ms": percentile(totals, 0.99),
        "ttfb_p95_ms": percentile(ttfbs, 0.95),
        "cache_hit_rate": len(cache_hits) / len(results) if results else 0,
        "status_counts": {str(code): sum(1 for item in results if item.status == code) for code in sorted({item.status for item in results})},
    }


def should_stop(summary: dict, baseline_p95: float, consecutive_5xx: int) -> str:
    if summary["error_rate"] > 0.01:
        return "error rate exceeded 1%"
    if baseline_p95 and summary["p95_ms"] > baseline_p95 * 3:
        return "p95 latency exceeded 3x baseline"
    if consecutive_5xx >= MAX_CONSECUTIVE_5XX:
        return f"received {MAX_CONSECUTIVE_5XX} consecutive 5xx responses"
    return ""


def run_stage(base_url: str, paths: list[str], stage_no: int, users: int, target_rps: float, duration: int,
              baseline_p95: float) -> tuple[list[Result], dict, str]:
    results: list[Result] = []
    lock = threading.Lock()
    stop_reason = ""
    consecutive_5xx = 0
    started = time.monotonic()
    deadline = started + duration
    next_request = started
    futures = set()

    with ThreadPoolExecutor(max_workers=users) as pool:
        while time.monotonic() < deadline and not stop_reason:
            now = time.monotonic()
            done = {future for future in futures if future.done()}
            for future in done:
                futures.remove(future)
                item = future.result()
                with lock:
                    results.append(item)
                consecutive_5xx = consecutive_5xx + 1 if item.status >= 500 else 0

            if len(futures) < users and now >= next_request:
                path = random.choice(paths)
                futures.add(pool.submit(fetch, base_url, path, stage_no))
                next_request += 1.0 / target_rps
            else:
                time.sleep(min(0.02, max(0.001, next_request - now)))

            if len(results) >= max(10, int(target_rps * 5)):
                current = stage_summary(results, max(time.monotonic() - started, 0.001))
                stop_reason = should_stop(current, baseline_p95, consecutive_5xx)

        for future in as_completed(futures):
            results.append(future.result())

    elapsed = max(time.monotonic() - started, 0.001)
    summary = stage_summary(results, elapsed)
    stop_reason = stop_reason or should_stop(summary, baseline_p95, consecutive_5xx)
    return results, summary, stop_reason


def write_outputs(output_dir: Path, metadata: dict, results: list[Result], summaries: list[dict]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "requests.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(asdict(results[0]).keys()) if results else list(Result.__annotations__))
        writer.writeheader()
        writer.writerows(asdict(item) for item in results)
    payload = {"metadata": metadata, "stages": summaries}
    (output_dir / "summary.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Serdiya capacity test report", "",
        f"- Target: `{metadata['base_url']}`",
        f"- Profile: `{metadata['profile']}`",
        f"- Environment: `{metadata['target_env']}`",
        f"- Started: {metadata['started_at']}",
        f"- Pages tested: {metadata['path_count']}", "",
        "| Stage | Users | Target req/s | Requests | Actual req/s | p95 | TTFB p95 | Errors | Edge cache | Result |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    for item in summaries:
        lines.append(
            f"| {item['stage']} | {item['users']} | {item['target_rps']} | {item['requests']} | "
            f"{item['rps']:.2f} | {item['p95_ms']:.0f} ms | {item['ttfb_p95_ms']:.0f} ms | "
            f"{item['error_rate'] * 100:.2f}% | {item['cache_hit_rate'] * 100:.1f}% | "
            f"{item.get('stop_reason') or 'healthy'} |"
        )
    lines.extend(["", "The test stops before an outage; checkout, account, admin, payment, and write endpoints are never called."])
    (output_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Safe, read-only Serdiya capacity tester")
    parser.add_argument("--base-url", default="https://serdiyajewellers.com")
    parser.add_argument("--profile", choices=tuple(PROFILES), default="baseline")
    parser.add_argument("--target-env", choices=("production", "staging"), default="production")
    parser.add_argument("--output", default="/tmp/serdiya-capacity")
    parser.add_argument("--list-pages", action="store_true", help="Discover and print the safe page count without testing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    parsed = urllib.parse.urlparse(args.base_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise SystemExit("Refused: --base-url must be a valid HTTPS URL")

    prod = is_production(args.base_url)
    if prod and (args.target_env != "production" or args.profile not in {"baseline", "canary"}):
        raise SystemExit("Refused: production allows only baseline or canary; heavy profiles have no override")
    if not prod and args.target_env != "staging":
        raise SystemExit("Refused: a non-production hostname must be explicitly marked --target-env staging")

    paths = discover_paths(args.base_url)
    if not paths or any(not safe_path(path) for path in paths):
        raise SystemExit("Refused: page discovery produced an unsafe path")
    if args.list_pages:
        print(f"Safe pages discovered: {len(paths)}")
        return 0

    started_at = datetime.now(timezone.utc).isoformat()
    all_results: list[Result] = []
    summaries: list[dict] = []
    baseline_p95 = 0.0
    print(f"Target={args.base_url} profile={args.profile} pages={len(paths)}")

    for stage_no, (users, target_rps, duration) in enumerate(PROFILES[args.profile], start=1):
        print(f"Stage {stage_no}: users={users}, target_rps={target_rps}, duration={duration}s")
        results, summary, stop_reason = run_stage(
            args.base_url, paths, stage_no, users, target_rps, duration, baseline_p95
        )
        if not baseline_p95:
            baseline_p95 = summary["p95_ms"]
        summary.update({"stage": stage_no, "users": users, "target_rps": target_rps, "duration_seconds": duration,
                        "stop_reason": stop_reason})
        summaries.append(summary)
        all_results.extend(results)
        print(f"  actual={summary['rps']:.2f} req/s p95={summary['p95_ms']:.0f}ms errors={summary['error_rate']*100:.2f}% cache-hit={summary['cache_hit_rate']*100:.1f}%")
        if stop_reason:
            print(f"STOPPED: {stop_reason}")
            break
        time.sleep(3)

    output_dir = Path(args.output)
    write_outputs(output_dir, {
        "base_url": args.base_url,
        "profile": args.profile,
        "target_env": args.target_env,
        "started_at": started_at,
        "path_count": len(paths),
        "user_agent": USER_AGENT,
    }, all_results, summaries)
    print(f"Reports written to {output_dir}")
    return 2 if summaries and summaries[-1].get("stop_reason") else 0


if __name__ == "__main__":
    raise SystemExit(main())
