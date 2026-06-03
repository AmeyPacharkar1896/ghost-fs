// crypto_utils.js - Ephemeral AES-256-GCM Encryption/Decryption

const CryptoUtils = {
    // Generate a random 256-bit (32 byte) key and return it as a Hex string
    async generateEphemeralKey() {
        const key = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
        const exported = await window.crypto.subtle.exportKey("raw", key);
        return this.buf2hex(exported);
    },

    // Convert hex string key back to CryptoKey
    async importKey(hexStr) {
        const keyBytes = this.hex2buf(hexStr);
        return await window.crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );
    },

    // Encrypt File: 
    // Format: [ MAGIC(5) | Nonce(12) | PayloadSize(4) | AES-GCM Encrypted Data ]
    // Inside Encrypted Data: [ NameLen(4) | NameBytes | FileLen(8) | FileBytes ]
    async encryptPayload(filename, fileBytes, hexKey) {
        const cryptoKey = await this.importKey(hexKey);
        const nonce = window.crypto.getRandomValues(new Uint8Array(12));
        
        // 1. Build inner payload (Name + Data)
        const encoder = new TextEncoder();
        const nameBytes = encoder.encode(filename);
        
        // Use DataView for exact byte writing (Big Endian to match Rust's original style)
        const innerSize = 4 + nameBytes.length + 8 + fileBytes.length;
        const innerBuffer = new Uint8Array(innerSize);
        const innerView = new DataView(innerBuffer.buffer);
        
        innerView.setUint32(0, nameBytes.length, false); // Big Endian
        innerBuffer.set(nameBytes, 4);
        
        // JS DataView setBigUint64 requires BigInt
        innerView.setBigUint64(4 + nameBytes.length, BigInt(fileBytes.length), false);
        innerBuffer.set(fileBytes, 12 + nameBytes.length);
        
        // 2. Encrypt inner payload
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce },
            cryptoKey,
            innerBuffer
        );
        const encryptedBytes = new Uint8Array(encryptedBuffer);
        
        // 3. Build outer package (GHOST + Nonce + Size + Encrypted)
        const magic = encoder.encode("GHOST");
        const outerSize = magic.length + nonce.length + 4 + encryptedBytes.length;
        const finalPackage = new Uint8Array(outerSize);
        const outerView = new DataView(finalPackage.buffer);
        
        finalPackage.set(magic, 0); // 5 bytes
        finalPackage.set(nonce, 5); // 12 bytes
        outerView.setUint32(17, encryptedBytes.length, false); // 4 bytes
        finalPackage.set(encryptedBytes, 21);
        
        return finalPackage;
    },

    async decryptPayload(encryptedBytes, nonce, hexKey) {
        const cryptoKey = await this.importKey(hexKey);
        
        try {
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: nonce },
                cryptoKey,
                encryptedBytes
            );
            
            const decrypted = new Uint8Array(decryptedBuffer);
            const view = new DataView(decrypted.buffer);
            
            const nameLen = view.getUint32(0, false);
            const decoder = new TextDecoder();
            const filename = decoder.decode(decrypted.slice(4, 4 + nameLen));
            
            const fileLen = Number(view.getBigUint64(4 + nameLen, false));
            const startOfData = 12 + nameLen;
            const fileData = decrypted.slice(startOfData, startOfData + fileLen);
            
            return { filename, fileData };
            
        } catch (e) {
            console.error("Decryption failed. Incorrect key or corrupt data.");
            throw e;
        }
    },

    // Helpers
    buf2hex(buffer) {
        return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
    },
    hex2buf(hexString) {
        const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
        }
        return bytes;
    }
};
