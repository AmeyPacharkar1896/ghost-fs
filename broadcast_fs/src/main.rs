use rand::prelude::*;
use std::fs::File;
use std::io::{Read, Write};
use std::process::{Command, Stdio};

fn main() {
    let width = 1280;
    let height = 720;
    let filename = "test.txt";

    // 1. Read File Data
    let mut input_file = File::open(filename).expect("File not found");
    let mut file_content = Vec::new();
    input_file
        .read_to_end(&mut file_content)
        .expect("Read failed");

    // 2. Build the Header
    let mut header = Vec::new();
    let name_bytes = filename.as_bytes();
    header.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes()); // 4 bytes for name len
    header.extend_from_slice(name_bytes); // The name
    header.extend_from_slice(&(file_content.len() as u64).to_be_bytes()); // 8 bytes for file len

    // 3. Combine Header + Content
    let mut full_payload = header;
    full_payload.extend(file_content);

    // 4. Setup FFmpeg
    let mut child = Command::new("ffmpeg")
        .args([
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-video_size",
            &format!("{}x{}", width, height),
            "-i",
            "-",
            "-c:v",
            "libx264rgb",
            "-crf",
            "0",
            "-preset",
            "ultrafast",
            "-tune",
            "zerolatency",
            "-f",
            "mpegts",
            "-method",
            "POST",
            "http://127.0.0.1:4000/stream",
        ])
        .stdin(Stdio::piped())
        .spawn()
        .expect("FFmpeg failed");

    let mut stdin = child.stdin.take().expect("Stdin failed");
    let mut rng = rand::rng();
    let mut byte_cursor = 0;
    let mut bit_cursor = 0;

    loop {
        let mut frame_pixels = Vec::with_capacity(width * height * 3);
        for _ in 0..(width * height) {
            let color = if byte_cursor < full_payload.len() {
                let bit = (full_payload[byte_cursor] >> (7 - bit_cursor)) & 1;
                bit_cursor += 1;
                if bit_cursor == 8 {
                    bit_cursor = 0;
                    byte_cursor += 1;
                }
                if bit == 1 { 255 } else { 0 }
            } else {
                rng.random_range(0..=255)
            };
            for _ in 0..3 {
                frame_pixels.push(color);
            }
        }
        stdin.write_all(&frame_pixels).unwrap();
        if byte_cursor >= full_payload.len() {
            break;
        }
    }

    let status = child.wait().expect("FFmpeg failed to finish");
    println!("FFmpeg exited with status: {:?}", status);
}
