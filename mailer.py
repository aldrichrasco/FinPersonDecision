"""
Minimal transactional email sender for FinPerson.

Uses SMTP if SMTP_HOST is configured — a Gmail app password, SendGrid,
Mailgun, or any other provider's SMTP endpoint all work the same way
through smtplib, so nothing provider-specific lives here. If SMTP_HOST
isn't set, the message is printed to the server console instead of
failing silently, so password reset still works end-to-end in local
development with zero mail setup — same "sensible fallback, not a
missing feature" pattern this repo already uses for the LLM provider.
"""

import os
import smtplib
from email.message import EmailMessage

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "") or SMTP_USER or "no-reply@finperson.local"


def send_email(to, subject, body):
    if not SMTP_HOST:
        print(
            f"\n[mailer] SMTP_HOST not configured — printing instead of sending.\n"
            f"To: {to}\nSubject: {subject}\n\n{body}\n",
            flush=True,
        )
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
        smtp.starttls()
        if SMTP_USER:
            smtp.login(SMTP_USER, SMTP_PASS)
        smtp.send_message(msg)
