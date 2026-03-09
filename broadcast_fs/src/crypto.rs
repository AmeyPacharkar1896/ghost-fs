use aes_gcm::{
    Aes256Gcm, Key, Nonce,
    aead::{Aead, KeyInit},
};

const SECRET_KEY: &[u8; 32] = b"GHOST_PROTOCOL_SECRET_KEY_32BYTE";
const MAGIC_SIGNATURE: &[u8; 5] = b"GHOST";

pub fn prepare_payload(filename: &str, file_content: &[u8]) -> Vec<u8> {
    // 1. Build Raw Header: [NameLen(4) | Name | FileLen(8) | Data]
    let mut raw_payload = Vec::new();
    let name_bytes = filename.as_bytes();

    // Note: The JS frontend expects Big Endian, to_be_bytes() ensures this.
    raw_payload.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
    raw_payload.extend_from_slice(name_bytes);
    raw_payload.extend_from_slice(&(file_content.len() as u64).to_be_bytes());
    raw_payload.extend_from_slice(file_content);

    // 2. Encrypt (AES-256)
    let key = Key::<Aes256Gcm>::from_slice(SECRET_KEY);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(b"unique_nonce");

    let encrypted_payload = cipher
        .encrypt(&nonce, raw_payload.as_ref())
        .expect("Encryption failure!");

    // 3. Final Package: [ "GHOST" | TotalEncryptedSize(4) | EncryptedData ]
    let mut final_payload = Vec::new();
    final_payload.extend_from_slice(MAGIC_SIGNATURE);

    // JS reads the size as a 32-bit uint, so Big Endian is required here too.
    final_payload.extend_from_slice(&(encrypted_payload.len() as u32).to_be_bytes());
    final_payload.extend(encrypted_payload);

    final_payload
}
