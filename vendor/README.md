These local npm packages contain the coordinated RPC 5 changes. They make this checkout installable before the matching versions are published. `npm ci` verifies the SHA-512 integrity recorded in package-lock.json; SHA256SUMS records the same archives for review.

To update, build and pack the sibling neurai-rpc / neurai-depin-msg source repositories, replace these archives, update both manifests and the lockfile, and run the integration tests. No package has been published as part of this change. Switch to registry versions only after the matching releases exist.
