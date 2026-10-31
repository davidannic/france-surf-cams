// Password gate for the whole site (Cloudflare Pages Functions).
// The password lives in the SITE_PASSWORD secret (Pages project → Settings → Variables and Secrets).
// A successful login sets a cookie derived from the password, so changing the password logs everyone out.

const COOKIE = "fsc_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const LOGIN_PATH = "/__login";
const LOGOUT_PATH = "/__logout";
// Served without login so the phone can show the app name and icon when installing.
const PUBLIC = [/^\/manifest\.webmanifest$/, /^\/icons\/[\w.-]+$/];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const password = env.SITE_PASSWORD;

  if (PUBLIC.some((re) => re.test(url.pathname))) return next();

  if (!password) {
    return page("Le mot de passe du site n'est pas encore configuré.", { status: 503, form: false });
  }
  const token = await tokenFor(password);

  if (url.pathname === LOGOUT_PATH) {
    return redirect("/", clearCookie());
  }

  if (url.pathname === LOGIN_PATH && request.method === "POST") {
    const form = await request.formData();
    const given = String(form.get("password") || "");
    const target = safeNext(String(form.get("next") || "/"));
    if (await sameSecret(given, password)) {
      return redirect(target, `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
    }
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    return page("Mot de passe incorrect.", { status: 401, next: target });
  }

  if (readCookie(request, COOKIE) === token) return next();

  return page("", { status: 401, next: url.pathname + url.search });
}

async function tokenFor(password) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("france-surf-cams-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Compares hashes so the time taken doesn't depend on where the strings differ.
async function sameSecret(a, b) {
  const [ha, hb] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))));
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Only allow redirects back into this site.
function safeNext(p) {
  return p.startsWith("/") && !p.startsWith("//") && !p.startsWith(LOGIN_PATH) ? p : "/";
}

function redirect(location, cookie) {
  return new Response(null, { status: 303, headers: { Location: location, "Set-Cookie": cookie, "Cache-Control": "no-store" } });
}

function esc(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function page(message, { status, next = "/", form = true }) {
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#070b14">
<meta name="robots" content="noindex">
<title>France Surf Cams</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Surf Cams">
<style>
:root{--bg:#070b14;--panel:#0e1524;--line:#2a3850;--text:#e7edf7;--muted:#8392aa;--accent:#38bdf8;--accent-ink:#04121d;--bad:#f87171}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{min-height:100vh;display:grid;place-items:center;padding:24px max(16px,env(safe-area-inset-right)) 24px max(16px,env(safe-area-inset-left))}
.box{width:100%;max-width:340px;display:flex;flex-direction:column;gap:16px}
img{width:64px;height:64px;border-radius:14px}
h1{margin:0;font-size:22px;color:var(--accent)}
p{margin:0;color:var(--muted)}
.err{color:var(--bad)}
form{display:flex;flex-direction:column;gap:10px}
label{font-size:13px;color:var(--muted)}
input{font:inherit;color:inherit;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;outline:none}
input:focus{border-color:var(--accent)}
button{font:inherit;font-weight:600;cursor:pointer;background:var(--accent);color:var(--accent-ink);border:0;border-radius:10px;padding:12px 14px}
button:focus-visible{outline:2px solid var(--text);outline-offset:2px}
</style>
</head>
<body>
<main>
  <div class="box">
    <img src="/icons/icon-180.png" alt="">
    <h1>France Surf Cams</h1>
    ${form ? "<p>Site privé. Entre le mot de passe pour voir les webcams.</p>" : ""}
    ${message ? `<p class="${form ? "err" : ""}" role="alert">${esc(message)}</p>` : ""}
    ${form ? `<form method="post" action="${LOGIN_PATH}">
      <input type="hidden" name="next" value="${esc(next)}">
      <label for="password">Mot de passe</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
      <button type="submit">Entrer</button>
    </form>` : ""}
  </div>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
