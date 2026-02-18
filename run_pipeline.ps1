# 1. Build and Run the Broadcaster
Write-Host "--- 📡 Phase 1: Broadcasting ---" -ForegroundColor Cyan
cd broadcast_fs
cargo run --release
cd ..

# 2. Build and Run the Decoder
Write-Host "`n--- 📥 Phase 2: Decoding ---" -ForegroundColor Cyan
cd broadcast_decoder
cargo run --release
cd ..

# 3. Run the Comparison Script
Write-Host "`n--- 🧪 Phase 3: Comparison ---" -ForegroundColor Cyan
python compare.py

Write-Host "`nPipeline Execution Complete." -ForegroundColor Green