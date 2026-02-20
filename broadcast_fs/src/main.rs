use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, KeyInit},
};
use rand::RngExt;
use std::fs::File;
use std::io::{self, BufRead, Read, Write};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;

fn main() {
    let width = 1280;
    let height = 720;
    let decoy_video = "decoy.mp4";

    println!("> GHOST_FS STATION BOOTING...");

    // 1. Generate Frequency
    let mut rng = rand::rng();
    let frequency = format!(
        "{:03}.{:02}",
        rng.random_range(100..=999),
        rng.random_range(0..=99)
    );
    let target_url = format!("http://127.0.0.1:4000/stream/{}", frequency);

    println!("========================================");
    println!("> 📡 BROADCASTING CONTINUOUS DECOY ON FREQ: {}", frequency);
    println!("========================================");

    // 2. Setup the Inter-Thread Communication Channel
    // This allows the Console to send encrypted payloads to the Video Stream
    let (tx, rx) = mpsc::channel::<Vec<u8>>();

    // 3. Spawning the Command Console Thread
    thread::spawn(move || {
        let stdin = io::stdin();
        println!("> COMMAND CONSOLE READY.");
        println!("> Type a filename (e.g., test.txt) and press ENTER to inject payload.");

        for line in stdin.lock().lines() {
            let filename = line.unwrap();
            let filename = filename.trim();
            if filename.is_empty() {
                continue;
            }

            println!("> READING PAYLOAD: {}", filename);
            if let Ok(mut input_file) = File::open(filename) {
                let mut file_content = Vec::new();
                input_file.read_to_end(&mut file_content).unwrap();

                // Build & Encrypt
                let mut raw_payload = Vec::new();
                let name_bytes = filename.as_bytes();
                raw_payload.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
                raw_payload.extend_from_slice(name_bytes);
                raw_payload.extend_from_slice(&(file_content.len() as u64).to_be_bytes());
                raw_payload.extend(file_content);

                let key = Key::<Aes256Gcm>::from_slice(b"GHOST_PROTOCOL_SECRET_KEY_32BYTE");
                let cipher = Aes256Gcm::new(key);
                let nonce = Nonce::from_slice(b"unique_nonce");
                let encrypted_payload = cipher
                    .encrypt(nonce, raw_payload.as_ref())
                    .expect("Encryption failure!");

                let mut final_payload = Vec::new();
                final_payload.extend_from_slice(b"GHOST");
                final_payload.extend_from_slice(&(encrypted_payload.len() as u32).to_be_bytes());
                final_payload.extend(encrypted_payload);

                println!(
                    "> PAYLOAD SECURED ({} bytes). SENDING TO BROADCAST TOWER...",
                    final_payload.len()
                );

                // Send to the video loop
                tx.send(final_payload).unwrap();
            } else {
                println!("> ERROR: FILE '{}' NOT FOUND.", filename);
            }
        }
    });

    // 4. Start Broadcast Hardware (FFmpeg)
    let mut decoder = Command::new("ffmpeg")
        .args([
            "-re",
            "-stream_loop",
            "-1",
            "-i",
            decoy_video,
            "-vf",
            &format!("scale={}:{}", width, height),
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("Failed to start decoy decoder.");

    let mut decoder_out = decoder
        .stdout
        .take()
        .expect("Failed to open decoder output");

    let mut encoder = Command::new("ffmpeg")
        .args([
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-video_size",
            &format!("{}x{}", width, height),
            "-framerate",
            "25",
            "-i",
            "-",
            "-c:v",
            "rawvideo",
            "-f",
            "rawvideo",
            "-method",
            "POST",
            &target_url,
        ])
        .stdin(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("Failed to start encoder");

    let mut encoder_in = encoder.stdin.take().expect("Failed to open encoder input");

    // 5. The Live Broadcast Loop
    let frame_size = width * height * 3;
    let mut frame_buffer = vec![0u8; frame_size];

    // State variables for active transmission
    let mut active_payload: Option<Vec<u8>> = None;
    let mut byte_cursor = 0;
    let mut bit_cursor = 0;

    loop {
        // A. Get a clean frame
        if decoder_out.read_exact(&mut frame_buffer).is_err() {
            break;
        }

        // B. Check if Console sent a new payload to inject
        if active_payload.is_none() {
            if let Ok(new_payload) = rx.try_recv() {
                println!(">> INJECTING PAYLOAD INTO LIVE FEED <<");
                active_payload = Some(new_payload);
                byte_cursor = 0;
                bit_cursor = 0;
            }
        }

        // C. Inject Data IF we have an active payload
        if let Some(ref payload) = active_payload {
            for i in 0..frame_size {
                if byte_cursor < payload.len() {
                    let bit = (payload[byte_cursor] >> (7 - bit_cursor)) & 1;
                    frame_buffer[i] = (frame_buffer[i] & 0xFE) | bit;

                    bit_cursor += 1;
                    if bit_cursor == 8 {
                        bit_cursor = 0;
                        byte_cursor += 1;
                    }
                } else {
                    println!(">> TRANSMISSION COMPLETE. BACK TO CLEAN FEED. <<");
                    active_payload = None; // Erase payload from active memory
                    break;
                }
            }
        }

        // D. Send frame out to Elixir
        if encoder_in.write_all(&frame_buffer).is_err() {
            println!("> ELIXIR CONNECTION LOST. Shutting down.");
            break;
        }
    }
}
