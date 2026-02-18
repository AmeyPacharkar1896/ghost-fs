use std::fs::File;
use std::io::Read;
use std::io::Write;
use std::process::{Command, Stdio};

fn main() {
    let width = 1280;
    let height = 720;
    let mut child = Command::new("ffmpeg")
        .args([
            "-i",
            "../broadcast_fs/broadcast_output.ts",
            "-f",
            "image2pipe",
            "-vcodec",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-",
        ])
        .stdout(Stdio::piped())
        .spawn()
        .expect("FFmpeg failed");

    let mut stdout = child.stdout.take().unwrap();
    let mut all_bits = Vec::new();
    let mut buffer = vec![0u8; width * height * 3];

    println!("Decoding stream...");

    while stdout.read_exact(&mut buffer).is_ok() {
        let mut current_byte = 0u8;
        let mut bit_count = 0;
        for i in (0..buffer.len()).step_by(3) {
            let bit = if buffer[i] > 128 { 1 } else { 0 };
            current_byte = (current_byte << 1) | bit;
            bit_count += 1;
            if bit_count == 8 {
                all_bits.push(current_byte);
                current_byte = 0;
                bit_count = 0;
            }
        }
    }

    // --- PARSE HEADER ---
    let name_len = u32::from_be_bytes(all_bits[0..4].try_into().unwrap()) as usize;
    let filename = String::from_utf8_lossy(&all_bits[4..4 + name_len]).to_string();
    let file_size =
        u64::from_be_bytes(all_bits[4 + name_len..12 + name_len].try_into().unwrap()) as usize;
    let start_of_data = 12 + name_len;
    let final_data = &all_bits[start_of_data..start_of_data + file_size];

    let out_name = format!("recovered_{}", filename);
    let mut out_file = File::create(&out_name).unwrap();
    out_file.write_all(final_data).unwrap();

    println!("Success! Recovered '{}' ({} bytes)", out_name, file_size);
}
