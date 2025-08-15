/**
 * Document Cache Module for DocuGen
 * Provides thread-safe caching for Google Docs with LRU eviction
 */

export interface CachedDocument {
  doc: any;
  timestamp: number;
  revision: string;
  etag?: string;
}

export class DocumentCache {
  private cache = new Map<string, CachedDocument>();
  private maxAge = 5 * 60 * 1000; // 5 minutes
  private maxSize = 100; // Maximum cache entries
  private locks = new Map<string, Promise<void>>();
  
  // Thread-safe wrapper for cache operations
  private async withLock<T>(key: string, operation: () => T): Promise<T> {
    // Wait for any existing lock
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }
    
    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(key, lockPromise);
    
    try {
      return operation();
    } finally {
      this.locks.delete(key);
      releaseLock!();
    }
  }
  
  async get(documentId: string): Promise<CachedDocument | null> {
    return await this.withLock(documentId, () => {
      const cached = this.cache.get(documentId);
      if (!cached) return null;
      
      if (Date.now() - cached.timestamp > this.maxAge) {
        this.cache.delete(documentId);
        return null;
      }
      
      // Update timestamp for LRU
      cached.timestamp = Date.now();
      return cached;
    });
  }
  
  async set(documentId: string, doc: any, revision: string): Promise<void> {
    await this.withLock(documentId, () => {
      // Implement LRU eviction if cache is full
      if (this.cache.size >= this.maxSize) {
        // Find and remove oldest entry
        let oldestKey: string | null = null;
        let oldestTime = Date.now();
        
        for (const [key, value] of this.cache.entries()) {
          if (value.timestamp < oldestTime) {
            oldestTime = value.timestamp;
            oldestKey = key;
          }
        }
        
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
      
      this.cache.set(documentId, {
        doc,
        timestamp: Date.now(),
        revision
      });
    });
  }
  
  async invalidate(documentId: string): Promise<void> {
    await this.withLock(documentId, () => {
      this.cache.delete(documentId);
    });
  }
  
  clear(): void {
    this.cache.clear();
    this.locks.clear();
  }
  
  // Get cache statistics
  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// Export singleton instance
export const documentCache = new DocumentCache();