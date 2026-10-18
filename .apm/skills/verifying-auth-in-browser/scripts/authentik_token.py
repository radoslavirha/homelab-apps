"""Log in as the E2E test user without a browser and print an access token for one UI's client.

    claude-e2e run -- python3 -I scripts/authentik_token.py <ui-base-url>

<ui-base-url> is where the UI is served, e.g. https://apps.sandbox.server1.homelab.irha.cz/qr-manager
or http://localhost:5173. Its config.json names the client, scope and redirect URI, so the token is
exactly the one that UI would get: same iss, aud and roles.

stdout: the access token, nothing else -- capture it, never echo it.
stderr: stage names, then the token's claims. Never a credential.

One login per call, in a fresh 30-second TOTP window (a code is accepted once). Call it once per run
and reuse the token: it lives 30 minutes and there is no refresh token.
"""
import base64, hashlib, hmac, http.cookiejar, json, os, secrets, struct, sys, time
import urllib.error, urllib.parse, urllib.request

AUTH = "https://auth.irha.cz"


def log(*a):
    print(*a, file=sys.stderr)


def die(msg):
    log("authentik_token:", msg)
    sys.exit(1)


if len(sys.argv) != 2:
    die("usage: authentik_token.py <ui-base-url>")
for var in ("E2E_USERNAME", "E2E_PASSWORD", "E2E_TOTP_SECRET"):
    if var not in os.environ:
        die(f"{var} missing -- run me under `claude-e2e run --`")
UI = sys.argv[1].rstrip("/")

jar = http.cookiejar.CookieJar()
follow = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


manual = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect)


def location(url):
    """GET without following redirects; the Location of a 3xx, else None."""
    try:
        manual.open(url, timeout=30).read()
        return None
    except urllib.error.HTTPError as e:
        if 300 <= e.code < 400:
            return urllib.parse.urljoin(url, e.headers["Location"])
        raise


def call(url, body=None):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    if body is not None:
        req.data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    # The executor answers a POST with 302 back to itself: "stage advanced, re-GET me".
    with follow.open(req, timeout=30) as r:
        return json.loads(r.read() or b"{}")


def totp(secret):
    time.sleep(30 - time.time() % 30 + 0.5)  # a fresh time step, never one already used
    s = secret.replace(" ", "").upper()
    k = base64.b32decode(s + "=" * (-len(s) % 8))
    h = hmac.new(k, struct.pack(">Q", int(time.time()) // 30), hashlib.sha1).digest()
    o = h[-1] & 15
    return "%06d" % ((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 1000000)


ANSWERS = {
    "ak-stage-identification": lambda: {"uid_field": os.environ["E2E_USERNAME"]},
    "ak-stage-password": lambda: {"password": os.environ["E2E_PASSWORD"]},
    # A code alone is enough: with one TOTP device no device selection is needed.
    "ak-stage-authenticator-validate": lambda: {"code": totp(os.environ["E2E_TOTP_SECRET"])},
}


def run_flow(slug, query):
    """Walk one flow via the executor API; return where its xak-flow-redirect points."""
    # The flow page's query string goes in ONE `query=` parameter. Passed raw, `next` is dropped
    # and the login "succeeds" onto /if/user/ with no code.
    ex = f"{AUTH}/api/v3/flows/executor/{slug}/?query=" + urllib.parse.quote(query, safe="")
    ch, seen = call(ex), set()
    for _ in range(8):
        comp = ch.get("component")
        log(f"[{slug}] {comp}", "| errors on:", sorted(ch.get("response_errors") or {}) or "-")
        if comp == "xak-flow-redirect":
            return urllib.parse.urljoin(AUTH, ch["to"])
        if comp not in ANSWERS or comp in seen:
            # Never loop: each failed code counts toward the -5 reputation lockout (24 h).
            die("unexpected or repeated stage -- stopping, not retrying")
        seen.add(comp)
        ch = call(ex, {"component": comp, **ANSWERS[comp]()})
    die("too many stages")


def code_from(url, redirect_uri):
    if not url.startswith(redirect_uri):
        return None
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    if "code" not in q:
        die(f"callback without a code: error={q.get('error')}")
    return q["code"][0]


cfg = json.load(urllib.request.urlopen(UI + "/config.json", timeout=30))["auth"]
verifier = secrets.token_urlsafe(48)
challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
url = f"{AUTH}/application/o/authorize/?" + urllib.parse.urlencode({
    "client_id": cfg["clientId"], "redirect_uri": cfg["redirectUri"], "response_type": "code",
    "scope": cfg["scope"], "state": secrets.token_urlsafe(8),
    "code_challenge": challenge, "code_challenge_method": "S256",
})

code = None
for _ in range(10):
    loc = location(url)
    if loc is None:
        die("authorize answered 200, expected a redirect")
    code = code_from(loc, cfg["redirectUri"])
    if code:
        break
    p = urllib.parse.urlparse(loc)
    url = run_flow(p.path.split("/")[3], p.query) if p.path.startswith("/if/flow/") else loc
    code = code_from(url, cfg["redirectUri"])
    if code:
        break
if not code:
    die("no authorization code")

tok = json.load(urllib.request.urlopen(urllib.request.Request(
    f"{AUTH}/application/o/token/", data=urllib.parse.urlencode({
        "grant_type": "authorization_code", "code": code, "redirect_uri": cfg["redirectUri"],
        "client_id": cfg["clientId"], "code_verifier": verifier,
    }).encode()), timeout=30))
at = tok["access_token"]
c = json.loads(base64.urlsafe_b64decode(at.split(".")[1] + "=="))
log("token: iss", c.get("iss"), "| aud", c.get("aud"), "| user", c.get("preferred_username"),
    "| roles", c.get("roles"), "| lifetime", c.get("exp", 0) - c.get("iat", 0), "s")
print(at)
