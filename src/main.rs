use image::{ImageBuffer, Rgb};
use std::fs;

fn main() {
    let data = "BroadcastFS Level 1 Test: Hello Amey!".as_bytes();

    let width = 1280;
    let height = 720;

    let mut img = ImageBuffer::new(width, height);

    let mut byte_idx = 0;
    let mut bit_idx = 0;

    println!("Encoding {} bytes into a {}x{} frame...", data.len(), width, height);

    for (_x, _y, pixel) in img.enumerate_pixels_mut() {
        if byte_idx < data.len() {
            // Extract the specific bit (0 or 1)
            let bit = (data[byte_idx] >> (7 - bit_idx)) & 1;
            
            // Map bit to color: 1 = White (255), 0 = Black (0)
            let color = if bit == 1 { 255 } else { 0 };
            *pixel = Rgb([color, color, color]);

            bit_idx += 1;
            if bit_idx == 8 {
                bit_idx = 0;
                byte_idx += 1;
            }
        } else {
            // Fill the rest with random grey noise so it looks "weird"
            let noise: u8 = rand::random();
            *pixel = Rgb([noise, noise, noise]);
        }
    }

    img.save("test_frame.png").expect("Failed to save image");
    println!("Success! Created 'test_frame.png'.");
}
