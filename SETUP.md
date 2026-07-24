# Getting the coaches working

## 1. Get a key

Go to **https://console.anthropic.com** → **API Keys** → **Create Key**.
Copy it. It starts with `sk-ant-`.

## 2. Put it in a file

In this folder there's a file called **`.env.example`**.

- Make a copy of it
- Rename the copy to exactly **`.env`** (dot, then "env" — no `.txt`)
- Open it and replace `sk-ant-paste-your-key-here` with your real key
- Save

That's it. That file is the answer to "where do I put the token."

Your `.env` should look like:

```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx
SECRET_KEY=any-long-random-string-you-like
SAFEGUARDING_REGION=generic
COOKIE_SECURE=0
```

## 3. Run it

```
pip install -r requirements.txt
python3 server.py
```

Open **http://localhost:5000** — not the HTML file directly, or the coach
can't reach the backend.

## 4. Check it worked

Visit **http://localhost:5000/api/chat-info**

- `{"enabled": true, ...}` → the key is being read. Coaches will work.
- `{"enabled": false, ...}` → see below.

---

## If it says `enabled: false`

Almost always one of these:

| Symptom | Cause |
|---|---|
| File is named `.env.txt` | Windows hides extensions. Turn on "show file extensions" and rename. |
| File is in the wrong folder | It must sit next to `server.py`. |
| Key has quotes or spaces | `ANTHROPIC_API_KEY=sk-ant-...` — no quotes, no space around `=`. |
| Server was already running | Stop it (Ctrl+C) and start again. It reads `.env` once at startup. |

The app doesn't crash without a key — the quiz and sandbox still work, and the
chat page tells the user coaching isn't switched on. So this message means
configuration, not a bug.

---

## Deploying to Render

**Don't** upload your `.env` — it's git-ignored on purpose.

Instead: Render dashboard → your service → **Environment** (left sidebar) →
**Add Environment Variable**

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your `sk-ant-...` key |
| `SECRET_KEY` | Render can generate this |
| `COOKIE_SECURE` | `1` |
| `SAFEGUARDING_REGION` | `generic` or `nz` |

Save — Render redeploys automatically. `render.yaml` already lists
`ANTHROPIC_API_KEY` as `sync: false`, which is why Render asks you for it
rather than expecting it in the repo.

---

## Configuring the rest

`.env.example` documents all 20 settings in eight sections. Only section 1 is
required. Three worth knowing about:

| Variable | Why it matters |
|---|---|
| `SAFEGUARDING_REGION` | Which support directory users see. **Phone numbers ship blank on purpose** — verify and localise them in `safeguarding.py` before real users arrive. |
| `SCENARIO_GENERATION_IN_STUDY` | Leave at `0` for any trial. Set to `1` and enrolled participants see LLM-generated scenarios, meaning people in the same arm receive different content — and therefore not the same intervention. |
| `CONSENT_VERSION` | Bump when the information sheet changes. Participants who consented under an older version stop being recorded until they re-consent. |

Switching model provider needs no code change — set `LLM_PROVIDER` to
`openai` or `gemini`, add that provider's key, and `pip install` its SDK.

## Cost

Coaching replies are short. On Claude Haiku it's roughly **$0.0016 per
message** — a few dollars covers thousands of exchanges. Set a spend limit in
the Anthropic console if you want a hard ceiling while testing.
