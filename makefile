# Emscripten compiler
EMCC = emcc

# Shared compiler flags
EMFLAGS_COMMON = -s ALLOW_MEMORY_GROWTH=1 \
				 -s INITIAL_MEMORY=134217728 \
				 -s NO_EXIT_RUNTIME=1 \
				 -s FORCE_FILESYSTEM=1 \
				 -s MODULARIZE=1 \
				 -s WASM=1 \
				 -s EXPORT_ES6=1 \
				 -s EXPORTED_FUNCTIONS="['_runMain','_malloc','_free']" \
				 -s EXPORTED_RUNTIME_METHODS=FS,setValue,stringToUTF8,stackAlloc,stackSave,stackRestore,intArrayFromString \
				 -DNODEPS=1 \
				 -Dmain=runMain

# Dev profile: debug-friendly build with sanitizer checks.
EMFLAGS_DEV = -O0 \
			  -s ASSERTIONS=1 \
			  -fsanitize=address

# Prod profile: optimized output for size/performance.
EMFLAGS_PROD = -O1 \
			   -s ASSERTIONS=0

# Source files
SRC = ./src/lib/dcraw.c

# Output directory
OUTPUT_DIR = ./bin

# Output file name
OUTPUT_FILE = $(OUTPUT_DIR)/dcraw.js

# Build metadata shipped with the package
BUILD_INFO_FILE = $(OUTPUT_DIR)/build-info.json

# Pinned Emscripten version (single source of truth) vs. installed emcc.
# The installed version is reduced to x.y.z so Homebrew's "-git" suffix still matches.
EMSCRIPTEN_PINNED := $(shell tr -d '[:space:]' < .emscripten-version 2>/dev/null)
EMSCRIPTEN_INSTALLED := $(shell $(EMCC) --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

# Git state at build time ("dirty" is null when not built from a git checkout)
GIT_COMMIT := $(shell git rev-parse HEAD 2>/dev/null || echo unknown)
GIT_DIRTY := $(shell if ! git rev-parse --git-dir > /dev/null 2>&1; then echo null; \
	elif [ -n "$$(git status --porcelain)" ]; then echo true; else echo false; fi)

# Writes $(BUILD_INFO_FILE) for the given profile
define write_build_info
	printf '{\n  "emscripten": "%s",\n  "profile": "%s",\n  "commit": "%s",\n  "dirty": %s\n}\n' \
		"$(EMSCRIPTEN_INSTALLED)" "$(1)" "$(GIT_COMMIT)" "$(GIT_DIRTY)" > $(BUILD_INFO_FILE)
endef

.PHONY: all dev prod prepare check-emscripten clean

# Default target
all: dev

# Rules
prepare:
	rm -rf $(OUTPUT_DIR)
	mkdir -p $(OUTPUT_DIR)

# Warn (never fail) when emcc differs from .emscripten-version
check-emscripten:
	@if [ -z "$(EMSCRIPTEN_PINNED)" ]; then \
		echo "warning: .emscripten-version is missing or empty" >&2; \
	elif [ "$(EMSCRIPTEN_INSTALLED)" != "$(EMSCRIPTEN_PINNED)" ]; then \
		echo "warning: emcc $(or $(EMSCRIPTEN_INSTALLED),not found) does not match .emscripten-version ($(EMSCRIPTEN_PINNED))" >&2; \
	fi

# Build rules
dev:check-emscripten prepare
	$(EMCC) $(SRC) -o $(OUTPUT_FILE) $(EMFLAGS_COMMON) $(EMFLAGS_DEV)
	$(call write_build_info,dev)

prod: check-emscripten prepare
	$(EMCC) $(SRC) -o $(OUTPUT_FILE) $(EMFLAGS_COMMON) $(EMFLAGS_PROD)
	$(call write_build_info,prod)

clean:
	rm -rf $(OUTPUT_DIR)