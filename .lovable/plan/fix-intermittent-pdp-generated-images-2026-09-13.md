# Fix intermittent PDP generated images

## Scope
- Make the PDP gallery refresh its image list after loading cached product data, so newly attached AI images appear reliably.
- Reconcile fresh gallery images even when the product row itself has not changed.
- Fix theme-specific PDPs that currently ignore extra gallery images whenever a primary image exists.
- Preserve the primary image first, deduplicate repeated URLs, and keep extra images ordered.

## Verification
- Check the first 10 Ring-1 products against their live `product_images` records.
- Verify default and alternate PDP gallery paths render primary plus extras.
- Confirm the preview builds cleanly and no primary image is replaced.
