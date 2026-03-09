mod crypto;
mod video;

use rand::RngExt;
use std::fs::File;
use std::io::{self, BufRead, Read, Write};
use std::sync::mpsc;
use std::thread;

// Helper to generate the frequency string
fn generate_freq() -> String {
    let mut rng = rand::rng();
    format!(
        "{:03}.{:02}",
        rng.random_range(100..=999),
        rng.random_range(0..=99)
    )
}

fn main() {
    let width = 1280;
    let height = 720;
    let decoy_video = "decoy.mp4";
    let fps = 25; // Matching FFmpeg framerate

    println!("> GHOST_FS STATION BOOTING...");

    // 1. Initial Frequency Setup
    let mut current_freq = generate_freq();
    println!("========================================");
    println!("> 📡 BROADCASTING DECOY ON FREQ: {}", current_freq);
    println!("========================================");

    // 2. Inter-Thread Comms
    let (tx, rx) = mpsc::channel::<Vec<u8>>();

    // 3. Command Console Thread
    thread::spawn(move || {
        let stdin = io::stdin();
        for line in stdin.lock().lines() {
            let filename = line.unwrap();
            let filename = filename.trim();
            if filename.is_empty() {
                continue;
            }

            if let Ok(mut input_file) = File::open(filename) {
                let mut file_content = Vec::new();
                input_file.read_to_end(&mut file_content).unwrap();
                let final_payload = crypto::prepare_payload(filename, &file_content);
                tx.send(final_payload).unwrap();
            } else {
                println!("> ERROR: FILE '{}' NOT FOUND.", filename);
            }
        }
    });

    // 4. Start Hardware
    let mut decoder_out = video::spawn_decoder(decoy_video, width, height);

    // Unpack the tuple to keep track of the process AND the input stream
    let mut target_url = format!("http://127.0.0.1:4000/stream/{}", current_freq);
    let (mut encoder_proc, mut encoder_in) = video::spawn_encoder(&target_url, width, height);

    // 5. State Machine Variables
    let frame_size = (width * height * 3) as usize;
    let mut frame_buffer = vec![0u8; frame_size];

    let mut active_payload: Option<Vec<u8>> = None;
    let mut byte_cursor = 0;
    let mut bit_cursor = 0;

    // 15 seconds * 25 FPS = 375 frames
    let mut cooldown_frames = 0;

    loop {
        // Read clean frame
        if decoder_out.read_exact(&mut frame_buffer).is_err() {
            break;
        }

        // --- HOPPING LOGIC ---
        if cooldown_frames > 0 {
            cooldown_frames -= 1;

            if cooldown_frames == 0 {
                println!(
                    ">> BURN TIMER EXPIRED. SCORCHING EARTH ON FREQ {} <<",
                    current_freq
                );

                // 1. Terminate current stream
                drop(encoder_in);
                let _ = encoder_proc.kill();
                let _ = encoder_proc.wait();

                // 2. Generate new frequency
                current_freq = generate_freq();
                target_url = format!("http://127.0.0.1:4000/stream/{}", current_freq);

                println!("> 📡 NEW BURNER FREQUENCY ESTABLISHED: {}", current_freq);

                // 3. Spin up new encoder
                let (new_proc, new_in) = video::spawn_encoder(&target_url, width, height);
                encoder_proc = new_proc;
                encoder_in = new_in;
            }
        }

        // --- INJECTION LOGIC ---
        if active_payload.is_none() && cooldown_frames == 0 {
            if let Ok(new_payload) = rx.try_recv() {
                println!(">> INJECTING PAYLOAD ON {} <<", current_freq);
                active_payload = Some(new_payload);
                byte_cursor = 0;
                bit_cursor = 0;
            }
        }

        if let Some(ref payload) = active_payload {
            let mut finished_injecting = false;

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
                    finished_injecting = true;
                    break;
                }
            }

            if finished_injecting {
                println!(">> TRANSMISSION COMPLETE. INITIATING 15s COUNTDOWN... <<");
                active_payload = None;
                cooldown_frames = fps * 15; // Start the 15-second death timer
            }
        }

        // Send out to Elixir
        if encoder_in.write_all(&frame_buffer).is_err() {
            // Only break if it fails when we aren't intentionally hopping
            if cooldown_frames != 0 {
                println!("> ELIXIR CONNECTION LOST UNEXPECTEDLY.");
                break;
            }
        }
    }
}
