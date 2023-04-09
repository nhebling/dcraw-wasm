# Emscripten compiler
EMCC = emcc

# Compiler flags
EMFLAGS = -O0 \
          -s ALLOW_MEMORY_GROWTH=1 \
          -s TOTAL_MEMORY=134217728 \
          -s NO_EXIT_RUNTIME=1 \
          -s FORCE_FILESYSTEM=1 \
          --memory-init-file 0 \
		  -s MODULARIZE=1 \
          -s WASM=1 \
		  -s EXPORT_ES6=1 \
          -s EXPORTED_FUNCTIONS="['_main']" \
		  -s EXPORTED_RUNTIME_METHODS=intArrayFromString,allocate,ALLOC_NORMAL \
		  -DNODEPS=1

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
all: prepare $(OUTPUT_FILE)

$(OUTPUT_FILE): $(SRC)
	$(EMCC) $(SRC) -o $(OUTPUT_FILE) $(EMFLAGS)  

clean:
	rm -rf $(OUTPUT_DIR)