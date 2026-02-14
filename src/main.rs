use std::io::Write;
use std::process::{Command, Stdio};
use rand::prelude::*;

fn main() {
    let width = 1280;
    let height = 720;

    let mut child = Command::new("ffmpeg")
        .args([
            "-f", "rawvideo",
            "-pixel_format", "rgb24",
            "-video_size", &format!("{}x{}", width, height),
            "-i", "-",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-f", "mpegts",
            "output.ts", 
        ])
        .stdin(Stdio::piped())
        .spawn()
        .expect("Failed to start ffmpeg. Is it in your PATH?");

    let mut stdin = child.stdin.take().expect("Failed to open stdin");

    let mut rng = rand::rng(); 

    println!("Broadcasting... Press Ctrl+C to stop.");

    loop {
        let mut frame = Vec::with_capacity(width * height * 3);
        
        for _ in 0..(width * height) {
            let val: u8 = rng.random(); 
            frame.push(val);
            frame.push(val); 
            frame.push(val); 
        }

        if let Err(_) = stdin.write_all(&frame) {
            break; 
        }
    }
}