use rand::prelude::*;
use std::fs::File;
use std::io::{Read, Write};
use std::process::{Command, Stdio};

fn main() {
    let width = 1280;
    let height = 720;

    // 1. Open the file
    let mut input_file =
        File::open("test.txt").expect("Please create a test.txt file in the same directory!");
    let mut buffer = Vec::new();
    input_file
        .read_to_end(&mut buffer)
        .expect("Failed to read test.txt");

    // 2. Setup FFmpeg
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
            "-preset",
            "ultrafast",
            "-tune",
            "zerolatency",
            "-f",
            "mpegts",
            "broadcast_output.ts",
        ])
        .stdin(Stdio::piped())
        .spawn()
        .expect("Failed to start ffmpeg");

    let mut stdin = child.stdin.take().expect("Failed to open stdin");
    let mut rng = rand::rng();

    let mut byte_cursor = 0;
    let mut bit_cursor = 0;

    println!("Starting Broadcast of file... Size: {} bytes", buffer.len());

    loop {
        // Pre-allocate space for one full 720p frame
        let mut frame_pixels = Vec::with_capacity(width * height * 3);

        for _ in 0..(width * height) {
            let color: u8;

            if byte_cursor < buffer.len() {
                // Use single '&' for bitwise AND
                let bit = (buffer[byte_cursor] >> (7 - bit_cursor)) & 1;
                color = if bit == 1 { 255 } else { 0 };

                bit_cursor += 1;
                if bit_cursor == 8 {
                    bit_cursor = 0;
                    byte_cursor += 1;
                }
            } else {
                color = rng.random();
            }

            frame_pixels.push(color);
            frame_pixels.push(color);
            frame_pixels.push(color);
        }

        // Match the variable name to 'frame_pixels'
        if let Err(_) = stdin.write_all(&frame_pixels) {
            break;
        }

        if byte_cursor >= buffer.len() {
            println!("File Broadcast complete! Closing stream...");
            break;
        }
    }
}
