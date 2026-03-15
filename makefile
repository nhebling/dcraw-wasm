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

# Rules
prepare:
	rm -rf $(OUTPUT_DIR)
	mkdir -p $(OUTPUT_DIR)

# Build rules
all: dev

dev: prepare
	$(EMCC) $(SRC) -o $(OUTPUT_FILE) $(EMFLAGS_COMMON) $(EMFLAGS_DEV)

prod: prepare
	$(EMCC) $(SRC) -o $(OUTPUT_FILE) $(EMFLAGS_COMMON) $(EMFLAGS_PROD)

clean:
	rm -rf $(OUTPUT_DIR)