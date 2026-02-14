import os

def compare_files(file1_path, file2_path):
    if not os.path.exists(file1_path) or not os.path.exists(file2_path):
        print(f"❌ Error: One or both files missing!")
        print(f"Looking for:\n 1. {file1_path}\n 2. {file2_path}")
        return

    # Check sizes first
    size1 = os.path.getsize(file1_path)
    size2 = os.path.getsize(file2_path)
    
    print(f"--- Comparison Report ---")
    print(f"Original file: {size1} bytes")
    print(f"Decoded file:  {size2} bytes")

    if size1 != size2:
        print("⚠️ Warning: File sizes do not match!")

    # Perform bit-for-bit comparison
    with open(file1_path, 'rb') as f1, open(file2_path, 'rb') as f2:
        original = f1.read()
        # The decoder might have extra trailing bits due to frame padding
        # so we only compare up to the length of the original
        decoded = f2.read(size1) 

        if original == decoded:
            print("✅ SUCCESS: The files are bit-for-bit identical!")
        else:
            print("❌ FAILURE: Data corruption detected.")
            # Find where it first broke
            for i, (b1, b2) in enumerate(zip(original, decoded)):
                if b1 != b2:
                    print(f"First mismatch at byte {i}: Original({hex(b1)}) != Decoded({hex(b2)})")
                    break

if __name__ == "__main__":
    # Adjust paths based on your folder structure
    original = "broadcast_fs/test.txt"
    decoded = "broadcast_decoder/recovered_test.txt"
    compare_files(original, decoded)