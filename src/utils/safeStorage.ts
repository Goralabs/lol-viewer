/**
 * Safe localStorage utilities with error handling
 * Handles cases where localStorage is disabled or throws errors
 */

const STORAGE_PREFIX = 'lol_viewer_'

/**
 * Safely get an item from localStorage
 * @param key - The key to retrieve
 * @returns The value or null if unavailable/error
 */
export function safeGetItem(key: string): string | null {
    try {
        return localStorage.getItem(STORAGE_PREFIX + key)
    } catch {
        // localStorage may be disabled or throw in private browsing
        return null
    }
}

/**
 * Safely set an item in localStorage
 * @param key - The key to set
 * @param value - The value to store
 * @returns true if successful, false otherwise
 */
export function safeSetItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, value)
        return true
    } catch {
        // localStorage may be disabled or full
        return false
    }
}

/**
 * Safely remove an item from localStorage
 * @param key - The key to remove
 */
export function safeRemoveItem(key: string): void {
    try {
        localStorage.removeItem(STORAGE_PREFIX + key)
    } catch {
        // Ignore errors
    }
}

/**
 * Get and parse a JSON value from localStorage
 * @param key - The key to retrieve
 * @param defaultValue - Default value if not found or invalid
 * @returns The parsed value or defaultValue
 */
export function safeGetJSON<T>(key: string, defaultValue: T): T {
    try {
        const value = localStorage.getItem(STORAGE_PREFIX + key)
        if (value === null) return defaultValue
        return JSON.parse(value) as T
    } catch {
        return defaultValue
    }
}

/**
 * Stringify and store a JSON value in localStorage
 * @param key - The key to set
 * @param value - The value to store
 * @returns true if successful, false otherwise
 */
export function safeSetJSON<T>(key: string, value: T): boolean {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
        return true
    } catch {
        return false
    }
}
