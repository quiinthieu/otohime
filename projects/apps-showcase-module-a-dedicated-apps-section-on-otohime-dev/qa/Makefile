.PHONY: help build test run

REPO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/../../..)
QA_DIR := projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/qa
NODE_TS := node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON

help:
	@echo "Targets for pm-303 / t-1882 & t-1883 executable QA suite:"
	@echo "  make help   - Display this help message"
	@echo "  make build  - Validate suite.json schema and budget (declared_s <= 1800)"
	@echo "  make test   - Run positive checks and verify negative controls fail as expected"
	@echo "  make run    - Run all positive QA checks sequentially"

build:
	@cd "$(REPO_ROOT)" && node -e 'const fs = require("node:fs"); const s = JSON.parse(fs.readFileSync("$(QA_DIR)/suite.json", "utf8")); if (s.schema !== "platform.role-suite.v1") process.exit(1); const declared = s.cases.reduce((acc, c) => acc + 2 * c.timeout_s, 0); console.log(JSON.stringify({ schema: s.schema, cases: s.cases.length, declared_s: declared, budget_s: 1800 })); if (declared > 1800) process.exit(3);'

run: build
	cd "$(REPO_ROOT)" && $(NODE_TS) $(QA_DIR)/check_data_and_nav.mts
	cd "$(REPO_ROOT)" && $(NODE_TS) $(QA_DIR)/check_preview_engine.mts
	cd "$(REPO_ROOT)" && node $(QA_DIR)/check_gates.mjs
	cd "$(REPO_ROOT)" && node $(QA_DIR)/check_browser_journey.mjs

test: run
	cd "$(REPO_ROOT)" && ( ! $(NODE_TS) $(QA_DIR)/check_data_and_nav.mts --negative-control )
	cd "$(REPO_ROOT)" && ( ! $(NODE_TS) $(QA_DIR)/check_preview_engine.mts --negative-control )
	cd "$(REPO_ROOT)" && ( ! node $(QA_DIR)/check_gates.mjs --negative-control )
	cd "$(REPO_ROOT)" && ( ! node $(QA_DIR)/check_browser_journey.mjs --negative-control )
