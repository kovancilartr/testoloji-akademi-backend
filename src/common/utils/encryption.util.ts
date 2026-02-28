import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class EncryptionUtil {
  private static getMasterKey(): Buffer {
    const key =
      process.env.ENCRYPTION_KEY || 'default-secret-key-must-be-32-char!';
    // Ensure key is 32 bytes for aes-256-cbc
    return crypto.createHash('sha256').update(key).digest();
  }

  static encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.getMasterKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  static decrypt(text: string): string {
    try {
      const [ivHex, encryptedHex] = text.split(':');
      if (!ivHex || !encryptedHex) return text;

      const iv = Buffer.from(ivHex, 'hex');
      const encryptedText = Buffer.from(encryptedHex, 'hex');
      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        this.getMasterKey(),
        iv,
      );
      let decrypted = decipher.update(encryptedText, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      return text; // Fallback to raw text if decryption fails
    }
  }
}
