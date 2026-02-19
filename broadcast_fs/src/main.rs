use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, KeyInit},
};
use std::fs::File;
use std::io::{Read, Write};
use std::process::{Command, Stdio};

fn main() {
    let width = 1280;
    let height = 720;
    // MAKE SURE THIS FILE EXISTS AND HAS DATA!
    let filename = "test.txt";
    // MAKE SURE THIS VIDEO FILE EXISTS!
    let decoy_video = "decoy.mp4";

    println!("> GHOST_FS PROTOCOL INITIATED...");

    // --- 1. PREPARE PAYLOAD (Read & Encrypt) ---
    println!("> READING PAYLOAD: {}", filename);
    let mut input_file = File::open(filename).expect("Payload file not found. Create test.txt!");
    let mut file_content = Vec::new();
    input_file
        .read_to_end(&mut file_content)
        .expect("Read failed");

    if file_content.is_empty() {
        panic!("Payload file is empty! Put some text in test.txt");
    }

    // Build Raw Header [NameLen(4) | Name | FileLen(8) | Data]
    let mut raw_payload = Vec::new();
    let name_bytes = filename.as_bytes();
    raw_payload.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
    raw_payload.extend_from_slice(name_bytes);
    raw_payload.extend_from_slice(&(file_content.len() as u64).to_be_bytes());
    raw_payload.extend(file_content);

    // Encrypt (AES-256)
    println!("> ENCRYPTING {} BYTES...", raw_payload.len());
    let key = Key::<Aes256Gcm>::from_slice(b"GHOST_PROTOCOL_SECRET_KEY_32BYTE");
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(b"unique_nonce"); // 12-bytes
    let encrypted_payload = cipher
        .encrypt(nonce, raw_payload.as_ref())
        .expect("Encryption failure!");

    // Final Package: [TotalEncryptedSize(4) | EncryptedData]
    let mut final_payload = Vec::new();
    final_payload.extend_from_slice(&(encrypted_payload.len() as u32).to_be_bytes());
    final_payload.extend(encrypted_payload);
    println!("> TOTAL TRANSMISSION SIZE: {} bytes", final_payload.len());

    // --- 2. START BROADCAST HARDWARE (FFmpeg) ---
    // Decoder: Loops source video infinitely
    let mut decoder = Command::new("ffmpeg")
        .args([
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
        .expect("Failed to start decoy decoder. Is decoy.mp4 present?");

    let mut decoder_out = decoder
        .stdout
        .take()
        .expect("Failed to open decoder output");

    // Encoder: Sends stream to Elixir
    let mut encoder = Command::new("ffmpeg")
        .args([
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-video_size",
            &format!("{}x{}", width, height),
            "-framerate",
            "25", // Force standard framerate
            "-i",
            "-",
            "-c:v",
            "rawvideo", // Keep it raw for uncompressed transmission
            "-f",
            "rawvideo",
            "-method",
            "POST",
            "http://127.0.0.1:4000/stream",
        ])
        .stdin(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("Failed to start encoder");

    let mut encoder_in = encoder.stdin.take().expect("Failed to open encoder input");

    // --- 3. THE BROADCAST LOOP ---
    println!("> STARTING CONTINUOUS BROADCAST.");
    println!("> INJECTING COVERT DATA...");

    let frame_size = width * height * 3;
    let mut frame_buffer = vec![0u8; frame_size];

    let mut byte_cursor = 0;
    let mut bit_cursor = 0;
    let mut is_transmitting = true;

    loop {
        // A. Get a clean frame from the cat video
        match decoder_out.read_exact(&mut frame_buffer) {
            Ok(_) => {}
            Err(_) => {
                println!("> SOURCE VIDEO STOPPED. Broadcast ending.");
                break;
            }
        }

        // B. Inject Data IF we are still transmitting
        if is_transmitting {
            for i in 0..frame_size {
                if byte_cursor < final_payload.len() {
                    // Get next bit
                    let bit = (final_payload[byte_cursor] >> (7 - bit_cursor)) & 1;
                    // Inject into LSB of pixel color component
                    frame_buffer[i] = (frame_buffer[i] & 0xFE) | bit;

                    bit_cursor += 1;
                    if bit_cursor == 8 {
                        bit_cursor = 0;
                        byte_cursor += 1;
                    }
                } else {
                    // Data finished mid-frame
                    println!(">>> TRANSMISSION COMPLETE. Switching to clean feed. <<<");
                    is_transmitting = false;
                    break; // Stop modifying this frame
                }
            }
        }
        // If is_transmitting is False, we skip B and send the clean frame.

        // C. Send frame to Elixir
        if encoder_in.write_all(&frame_buffer).is_err() {
            println!("> ELIXIR DISCONNECTED. Stopping broadcast.");
            break;
        }
    }

    // Cleanup (Only hit if ctrl+c or error)
    drop(encoder_in);
    let _ = encoder.wait();
    let _ = decoder.kill();
}
