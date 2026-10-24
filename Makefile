.PHONY: setup build lint test bench demo scan feed
setup:
	npm ci
build:
	npm run build
lint:
	npm run lint
test:
	npm test
bench:
	npm run bench
	node dist-node/scripts/render_readme.js
demo: setup build
	npm start
scan:
	npm audit --audit-level=low
feed:
	node dist-node/scripts/import_feed.js cloudflare
