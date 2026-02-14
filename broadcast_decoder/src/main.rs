use std::io::Read;
use std::process::{Command, Stdio};

fn main() {
    let width = 1280;
    let height = 720;

    let mut child = Command::new("ffmpeg")
        .args([
            "-i",
            "D:/BroadCastFS/broadcast_fs/broadcast_output.ts",
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
        .expect("Failed to start ffmpeg");

    let mut stdout = child.stdout.take().expect("Failed to open stdout");

    let mut decoded_bytes = Vec::new();
    let mut current_byte: u8 = 0;
    let mut bit_count = 0;

    let frame_size = (width * height * 3) as usize;
    let mut buffer = vec![0u8; frame_size];

    println!("Decoding video... please wait.");

    while stdout.read_exact(&mut buffer).is_ok() {
        for i in (0..buffer.len()).step_by(3) {
            let r = buffer[i];

            let bit = if r > 128 { 1 } else { 0 };

            current_byte = (current_byte << 1) | bit;
            bit_count += 1;

            if bit_count == 8 {
                decoded_bytes.push(current_byte);
                current_byte = 0;
                bit_count = 0;
            }
        }
    }

    std::fs::write("recovered_test.txt", &decoded_bytes).expect("Failed to save file");
    println!("Done! Check 'recovered_test.txt' in your folder.");
}
