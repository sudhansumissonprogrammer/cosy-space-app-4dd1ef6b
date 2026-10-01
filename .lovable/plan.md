# Private website capacity-test page

## Goal
Add an admin-only page at `/test-website` where you can enter an approved staging website, choose test intensity, see exactly how many requests will be sent, and download/copy the Python command for the existing tester.

## What will be built
- Protect the page with the existing ShopBanao admin-role check; signed-out and non-admin visitors cannot use it.
- Add target URL, test mode, concurrent visitors, requests per second, and duration controls.
- Show estimated total requests, average requests per visitor, run time, and traffic intensity before starting.
- Include ready-made Baseline, Ramp, Spike, and Soak presets matching the Python tester.
- Validate HTTPS URLs and visibly refuse known production domains, localhost, private-network addresses, payment/admin/checkout paths, and arbitrary live targets.
- Allow only explicitly approved staging hosts. Approval remains enforced by the Python runner, not only by the browser page.
- Provide Copy command and Download configuration actions so the test runs from a controlled machine; the browser itself will not generate distributed traffic.
- Show the automatic stop rules: over 1% errors, p95 over 3× baseline, three consecutive server failures, or request timeout.
- Add the page to the admin navigation and ensure it works on desktop and mobile.

## Technical details
- Reuse the existing Python capacity tester and admin authorization system.
- Keep calculations client-side and keep all execution safety checks in the Python script as the final enforcement boundary.
- Extract shared profiles/safety wording into a small frontend configuration module so displayed values stay consistent.
- Record the admin-only, staging-only architecture rule and verify routing, unauthorized access, calculations, mobile layout, and current build health.

## Safety boundary
The page will not provide a production override or a way to crash arbitrary websites. Aggressive tests remain available for production-sized staging copies, where failure can be measured without interrupting shoppers, orders, or payments.
