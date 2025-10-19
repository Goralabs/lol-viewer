/**
 * Utility functions for handling timestamps and frame indexing
 */

/**
 * Rounds a date down to the previous 10-second boundary
 * @param date The date to round
 * @returns A new Date rounded down to the previous 10-second boundary
 */
export function roundToPrevious10s(date: Date): Date {
  const rounded = new Date(date);
  rounded.setMilliseconds(0);
  
  if (rounded.getSeconds() % 10 !== 0) {
    rounded.setSeconds(rounded.getSeconds() - (rounded.getSeconds() % 10));
  }
  
  return rounded;
}

/**
 * Converts a Date to an ISO8601 string
 * @param date The date to convert
 * @returns ISO8601 string representation with .000Z format
 */
export function toISO(date: Date): string {
  const isoString = date.toISOString();
  return isoString.replace(/\.\d+Z$/, '.000Z');
}

/**
 * Converts an ISO8601 string to epoch milliseconds
 * @param iso The ISO8601 string to convert
 * @returns Epoch milliseconds
 */
export function isoToEpoch(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Converts any timestamp (Date or string) to epoch milliseconds
 * @param timestamp The timestamp to convert
 * @returns Epoch milliseconds
 */
export function toEpochMillis(timestamp: Date | string): number {
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  return new Date(timestamp).getTime();
}

/**
 * Finds the closest timestamp in an array to a target timestamp
 * @param timestamps Sorted array of timestamps
 * @param targetTimestamp Target timestamp to find closest match for
 * @returns Index of the closest timestamp
 */
export function findClosestTimestampIndex(timestamps: number[], targetTimestamp: number): number {
  if (timestamps.length === 0) return -1;
  
  // If target is before the first timestamp, return 0
  if (targetTimestamp <= timestamps[0]) return 0;
  
  // If target is after the last timestamp, return last index
  if (targetTimestamp >= timestamps[timestamps.length - 1]) return timestamps.length - 1;
  
  // Binary search for the closest timestamp
  let left = 0;
  let right = timestamps.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = timestamps[mid];
    
    if (midTimestamp === targetTimestamp) {
      return mid;
    } else if (midTimestamp < targetTimestamp) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  // At this point, right < left and target is between timestamps[right] and timestamps[left]
  // Return whichever is closer
  const leftDiff = Math.abs(timestamps[left] - targetTimestamp);
  const rightDiff = Math.abs(timestamps[right] - targetTimestamp);
  
  return leftDiff < rightDiff ? left : right;
}

/**
 * Checks if a gameState indicates the match is finished/completed
 * @param gameState The gameState string from the API
 * @returns true if the game is in a terminal state
 */
export function isTerminalGameState(gameState: string): boolean {
  if (!gameState) return false;
  
  const terminalStates = [
    'finished',
    'completed',
    'postgame',
    'post_game'
  ];
  
  return terminalStates.includes(gameState.toLowerCase());
}

/**
 * Gets the current UTC timestamp normalized to avoid drift
 * @returns Current UTC timestamp in milliseconds
 */
export function getCurrentUTCTime(): number {
  return Date.now();
}

/**
 * Filters games into upcoming and past categories based on a 24-hour window
 * @param games Array of games with startTime property
 * @param now Reference timestamp (defaults to current UTC time)
 * @returns Object with upcoming and past game arrays
 */
export function filterGamesByTimeWindow<T extends { startTime: Date | string }>(
  games: T[],
  now: number = getCurrentUTCTime()
): { upcoming: T[], past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  
  const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
  const nowMinus24h = now - twentyFourHoursInMs;
  const nowPlus24h = now + twentyFourHoursInMs;
  
  for (const game of games) {
    const gameTime = toEpochMillis(game.startTime);
    
    // Upcoming: startTime >= now and < now + 24h
    if (gameTime >= now && gameTime < nowPlus24h) {
      upcoming.push(game);
    }
    // Past: startTime >= now - 24h and < now
    else if (gameTime >= nowMinus24h && gameTime < now) {
      past.push(game);
    }
  }
  
  // Sort upcoming ascending by start time
  upcoming.sort((a, b) => toEpochMillis(a.startTime) - toEpochMillis(b.startTime));
  
  // Sort past descending by start time
  past.sort((a, b) => toEpochMillis(b.startTime) - toEpochMillis(a.startTime));
  
  return { upcoming, past };
}

/**
 * Checks if a game is currently in progress based on its state and start time
 * @param game Game object with startTime and state properties
 * @param now Reference timestamp (defaults to current UTC time)
 * @returns true if the game is in progress
 */
export function isGameInProgress<T extends { startTime: Date | string; state?: string }>(
  game: T,
  now: number = getCurrentUTCTime()
): boolean {
  const gameTime = toEpochMillis(game.startTime);
  
  // Game is in progress if it has started but not completed
  if (gameTime <= now && game.state && !isTerminalGameState(game.state)) {
    return true;
  }
  
  return false;
}

/**
 * Formats a timestamp to a localized 12-hour time format with AM/PM
 * @param timestamp The timestamp to format (Date or string)
 * @param includeDate Whether to include the date if not today (default: false)
 * @returns Formatted time string (e.g., "3:05 PM" or "Tue 3:05 PM")
 */
export function formatLocalizedTime(
  timestamp: Date | string,
  includeDate: boolean = false
): string {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return "TBD";
    }
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    
    let formattedTime = new Intl.DateTimeFormat(undefined, options).format(date);
    
    // If includeDate is true and it's not today, add the weekday
    if (includeDate && !isToday) {
      const weekdayOptions: Intl.DateTimeFormatOptions = { weekday: 'short' };
      const weekday = new Intl.DateTimeFormat(undefined, weekdayOptions).format(date);
      formattedTime = `${weekday} ${formattedTime}`;
    }
    
    return formattedTime;
  } catch (error) {
    console.error('Error formatting time:', error);
    return "TBD";
  }
}