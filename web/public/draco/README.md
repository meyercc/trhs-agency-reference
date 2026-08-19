# Draco decoder (vendored)

Copied verbatim from `three/examples/jsm/libs/draco/gltf/`. The Light Studio's
device GLBs are Draco-compressed, so `GLTFLoader` needs a `DRACOLoader` with a
decoder it can fetch at runtime — without it the models fail to load and the
devices silently never appear (which is exactly what happened until 2026-08-17).

Served from `public/` rather than bundled because the decoder loads its `.wasm`
by URL relative to `setDecoderPath()`. Re-copy these files when `three` is
upgraded; they are versioned with it.
