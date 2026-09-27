# Reliable paid-order Telegram alerts

## Goal
Ensure a paid order is not silently lost when Telegram is unavailable, without sending duplicate alerts when a message did arrive.

## Changes
- Check the current Telegram connection and verify a safe test send. Reconnect it in this workspace if needed.
- Replace the current “mark notified before sending” flow with a durable pending-delivery record for each paid order. Keep the same store-specific recipients and existing paid-order conditions.
- Have a scheduled worker claim pending alerts, retry temporary failures with limits and visible error status, and mark success only after the Telegram service confirms delivery. Use an idempotency key or per-recipient progress so a partial success is not resent blindly.
- Keep old missed alerts separate; do not resend historical messages without explicit approval.
- Test success, temporary failure, duplicate trigger, and partial-recipient failure, then deploy and check live logs.

## Technical details
The present database trigger sets `orders.telegram_notified_at` before `net.http_post`, whose asynchronous response is not available in that transaction. Clearing the stamp in the HTTP handler is unsafe: its update can fire the trigger again and cause duplicate or recursive sends. A durable queue and separate completion state are needed instead of an in-handler reset.
