import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// TOKEN ENCRYPTION UTILITIES
// ============================================================================

export class SecureTokenStorage {
  private algorithm = 'aes-256-gcm';
  private keyPath: string;
  private key: Buffer;
  
  constructor() {
    // Store encryption key in user's home directory
    this.keyPath = path.join(os.homedir(), '.docugen', 'encryption.key');
    this.key = this.loadOrCreateKey();
  }
  
  private loadOrCreateKey(): Buffer {
    try {
      if (fs.existsSync(this.keyPath)) {
        // Load existing key
        const keyHex = fs.readFileSync(this.keyPath, 'utf-8').trim();
        return Buffer.from(keyHex, 'hex');
      }
    } catch (error) {
      console.error('Failed to load encryption key, creating new one');
    }
    
    // Create new key
    const key = crypto.randomBytes(32);
    const keyHex = key.toString('hex');
    
    // Ensure directory exists
    const dir = path.dirname(this.keyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); // Secure permissions
    }
    
    // Save key with restricted permissions
    fs.writeFileSync(this.keyPath, keyHex, { mode: 0o600 });
    
    return key;
  }
  
  encrypt(plaintext: string): string {
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64')
    ]);
    
    return combined.toString('base64');
  }
  
  decrypt(encryptedData: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const iv = combined.slice(0, 16);
      const authTag = combined.slice(16, 32);
      const encrypted = combined.slice(32);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt token. Token may be corrupted or tampered with.');
    }
  }
  
  // Securely save token to file
  saveToken(tokenPath: string, token: any): void {
    const tokenJson = JSON.stringify(token);
    const encrypted = this.encrypt(tokenJson);
    
    // Ensure directory exists
    const dir = path.dirname(tokenPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    
    // Save with restricted permissions
    fs.writeFileSync(tokenPath, encrypted, { mode: 0o600 });
  }
  
  // Securely load token from file
  loadToken(tokenPath: string): any | null {
    try {
      if (!fs.existsSync(tokenPath)) {
        return null;
      }
      
      const encrypted = fs.readFileSync(tokenPath, 'utf-8');
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to load encrypted token:', error);
      return null;
    }
  }
  
  // Rotate encryption key (for security best practices)
  rotateKey(tokenPath: string): void {
    // Load existing token with old key
    const token = this.loadToken(tokenPath);
    
    if (token) {
      // Generate new key
      this.key = crypto.randomBytes(32);
      const keyHex = this.key.toString('hex');
      
      // Save new key
      fs.writeFileSync(this.keyPath, keyHex, { mode: 0o600 });
      
      // Re-encrypt token with new key
      this.saveToken(tokenPath, token);
      
      console.log('Encryption key rotated successfully');
    }
  }
}

// Export singleton instance
export const tokenStorage = new SecureTokenStorage();