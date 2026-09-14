# Permanent checkout address integrity

## Goal
Ensure a customer’s complete delivery address is preserved exactly, displayed fully, and never replaced by a partial value during checkout or payment retries.

## Changes
- Use one consistent completeness rule across current checkout, legacy checkout, saved addresses, location popup, and returning-customer autofill.
- Validate name, Indian phone, six-digit pincode, city, state, and a meaningful full street address before saving or paying.
- On payment retries, preserve an already-complete stored address if a browser sends an empty or partial replacement.
- Add strict length limits and normalized whitespace before address data is stored.
- Keep the full address wrapped and visible in checkout and order details rather than clipping it.
- Add focused tests for partial typing, stale payment callbacks, retries, and full-address persistence.

## Safety
- Server validation remains the final authority, so older clients cannot save incomplete delivery details.
- Existing complete addresses are never overwritten by shorter in-progress text.
- Ambiguous historical addresses will not be guessed or bulk-replaced.

## Verification
- Test the mobile checkout with a long multi-line address through address save, payment opening, and order persistence.
- Confirm the stored order, checkout summary, dashboard detail, Telegram/copy text, and invoice all receive the complete value.
- Check current diagnostics and focused tests before completion.
