use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

pub fn spawn_decoder(video_path: &str, width: i32, height: i32) -> ChildStdout {
    let mut decoder = Command::new("ffmpeg")
        .args([
            "-re", // Throttle to 1x Real-Time to prevent WebSockets from choking
            "-stream_loop",
            "-1",
            "-i",
            video_path,
            "-vf",
            &format!("scale={}:{}", width, height),
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null()) // Hide FFmpeg logs
        .spawn()
        .expect("Failed to start decoy decoder. Is decoy.mp4 present?");

    decoder
        .stdout
        .take()
        .expect("Failed to open decoder output")
}

pub fn spawn_encoder(target_url: &str, width: i32, height: i32) -> (Child, ChildStdin) {
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
            target_url,
        ])
        .stdin(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("Failed to start encoder");

    let stdin = encoder.stdin.take().expect("Failed to open encoder input");
    (encoder, stdin)
}
