import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Frame as FrameWindow, GameMetadata } from "./types/windowLiveTypes";
import { Frame as FrameDetails } from "./types/detailsLiveTypes";
import {
  getLiveWindowGame,
  getLiveDetailsGame,
  getISODateMultiplyOf10,
} from "../../utils/LoLEsportsAPI";
import {
  toISO,
  toEpochMillis,
  findClosestTimestampIndex,
  isTerminalGameState,
  detectGaps,
  generateGapFillTimestamps,
  generateSparseTimestamps,
  computeFrameSignature,
  delay,
} from "../../utils/timestampUtils";
import { useBackfill } from "../Navbar/BackfillContext";

interface FrameIndexState {
  framesWindow: Map<number, FrameWindow>;
  framesDetails: Map<number, FrameDetails>;
  orderedTimestamps: number[];
  hasFirstFrame: boolean;
  isBackfilling: boolean;
  livePointer: number;
  playbackPointer: number | null;
  metadata: GameMetadata | undefined;
  isFinal: boolean; // New flag to indicate if the game is finished

  // Live playback state
  isLivePaused: boolean;
  desiredLagMs: number;
  speedFactor: number;
  displayIndex: number;
  playQueue: number[];

  // Request tracking for deduplication
  requestedTimestamps: Set<number>;
  failedTimestamps: Set<number>;
  backfillPhase: 'idle' | 'sparse' | 'medium' | 'dense' | 'complete';

  // Terminal detection improvements
  lastFrameSignature: string | null;
  duplicateFrameCount: number;
  consecutiveEmptyResponses: number;
}

interface FrameIndexReturn {
  currentWindow: FrameWindow | undefined;
  currentDetails: FrameDetails | undefined;
  currentMetadata: GameMetadata | undefined;
  windowFrames: FrameWindow[];
  detailFrames: FrameDetails[];
  timestamps: number[];
  hasFirstFrame: boolean;
  isBackfilling: boolean;
  isLive: boolean;
  isFinal: boolean; // Expose isFinal flag
  selectedTimestamp: number | null;
  currentTimestamp: number | null;
  goLive: () => void;
  setPlaybackByEpoch: (epoch: number) => void;
  
  // Live playback controls
  isLivePaused: boolean;
  desiredLagMs: number;
  speedFactor: number;
  displayedTs: number | null;
  pauseLive: () => void;
  resumeLive: () => void;
  setDesiredLagMs: (ms: number) => void;
  setSpeedFactor: (factor: number) => void;
}

interface MergeResult {
  changed: boolean;
  addedEarlier: boolean;
  addedLater: boolean;
  hasFramesAfter: boolean;
}

const BACKFILL_RETRY_DELAY_MS = 1_000;
const BACKFILL_CONCURRENCY = 10; // Bounded concurrency for dense phase
const LIVE_POLL_INTERVAL_MS = 1000; // Reduce request rate for live polling
const FINAL_STATE_BACKOFF_MS = 60_000; // 1 minute backoff for finished games

// Multi-phase backfill constants
const SPARSE_STEP_MS = 60_000;        // 1 minute - quick sparse sampling
const MEDIUM_STEP_MS = 30_000;        // 30 seconds - medium density
const DENSE_STEP_MS = 10_000;         // 10 seconds - full resolution
const MAX_IN_FLIGHT = 25;             // Increased from 10 for faster backfill
const BATCH_DELAY_MS = 150;           // Reduced from 700ms
const DUPLICATE_THRESHOLD = 3;        // Stop if same frame N times
const EMPTY_RESPONSE_THRESHOLD = 5;   // Stop after N empty responses
const MAX_BACKFILL_RANGE_MS = 7_200_000; // 2 hours max backfill range

// Live playback constants
const DEFAULT_DESIRED_LAG_MS = 10_000; // 10 seconds behind live
const MIN_FRAME_MS = 150; // Minimum time between frames
const MAX_FRAME_MS = 4000; // Maximum time between frames
// DRIFT_CHECK_INTERVAL_MS is no longer needed since we removed automatic speed adjustments
const MAX_SPEED_FACTOR = 10.0; // Maximum playback speed

// Debug logging flag - only logs in development mode
const DEBUG_POLLING = import.meta.env.DEV;

const createInitialState = (): FrameIndexState => ({
  framesWindow: new Map(),
  framesDetails: new Map(),
  orderedTimestamps: [],
  hasFirstFrame: false,
  isBackfilling: false,
  livePointer: -1,
  playbackPointer: null,
  metadata: undefined,
  isFinal: false,

  // Live playback state
  isLivePaused: false,
  desiredLagMs: DEFAULT_DESIRED_LAG_MS,
  speedFactor: 1.0,
  displayIndex: -1,
  playQueue: [],

  // Request tracking for deduplication
  requestedTimestamps: new Set(),
  failedTimestamps: new Set(),
  backfillPhase: 'idle',

  // Terminal detection improvements
  lastFrameSignature: null,
  duplicateFrameCount: 0,
  consecutiveEmptyResponses: 0,
});

export function useFrameIndex(gameId: string): FrameIndexReturn {
  const { isBackfillEnabled } = useBackfill();
  const [state, setState] = useState<FrameIndexState>(() => createInitialState());
  const stateRef = useRef<FrameIndexState>(state);

  const setFrameState = useCallback(
    (updater: (prev: FrameIndexState) => FrameIndexState) => {
      setState((prev) => {
        const next = updater(prev);
        stateRef.current = next;
        return next;
      });
    },
    []
  );

  const isMountedRef = useRef(true);
  const backfillRunningRef = useRef(false);
  const backfillStartedRef = useRef(false);
  const cancelBackfillRef = useRef(false);
  const backfillCursorRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingInFlightRef = useRef(false);
  const finalStateBackoffRef = useRef<NodeJS.Timeout | null>(null);
  const backfillAbortControllerRef = useRef<AbortController | null>(null);
  const forwardAbortControllerRef = useRef<AbortController | null>(null);
  
  // Live playback refs
  const schedulerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const anchorWallRef = useRef<number>(Date.now());
  const anchorTsRef = useRef<number>(0);
  // driftCheckTimerRef is no longer needed since we removed automatic speed adjustments

  // Function to stop backfill immediately
  const stopBackfill = useCallback(() => {
    if (!backfillRunningRef.current) return;
    
    cancelBackfillRef.current = true;
    backfillRunningRef.current = false;
    backfillStartedRef.current = false;
    backfillCursorRef.current = null;
    
    // Cancel any ongoing backfill requests
    if (backfillAbortControllerRef.current) {
      backfillAbortControllerRef.current.abort();
      backfillAbortControllerRef.current = null;
    }
    
    setFrameState(prev =>
      prev.isBackfilling ? { ...prev, isBackfilling: false } : prev
    );
  }, [setFrameState]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Register the stopBackfill function with the BackfillContext
    if (typeof window !== 'undefined' && (window as { __registerStopBackfill?: (fn: () => void) => void }).__registerStopBackfill) {
      (window as { __registerStopBackfill?: (fn: () => void) => void }).__registerStopBackfill(stopBackfill);
    }
    
    return () => {
      isMountedRef.current = false;
      cancelBackfillRef.current = true;
      backfillRunningRef.current = false;
      backfillStartedRef.current = false;
      backfillCursorRef.current = null;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (finalStateBackoffRef.current) {
        clearTimeout(finalStateBackoffRef.current);
        finalStateBackoffRef.current = null;
      }
      // Clean up scheduler timers
      if (schedulerTimerRef.current) {
        clearTimeout(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
      // Cancel any ongoing backfill requests
      if (backfillAbortControllerRef.current) {
        backfillAbortControllerRef.current.abort();
        backfillAbortControllerRef.current = null;
      }
      // driftCheckTimerRef cleanup is no longer needed
    };
  }, [stopBackfill]);

  const mergeFrames = useCallback(
    (
      windowFrames: FrameWindow[],
      detailFrames: FrameDetails[],
      metadata?: GameMetadata
    ): MergeResult => {
      let changed = false;
      let addedEarlier = false;
      let addedLater = false;
      let hasFramesAfter = stateRef.current.orderedTimestamps.length > 0;
      const newLaterFrames = new Set<number>();

      const hasPayload = windowFrames.length > 0 || detailFrames.length > 0;
      const shouldSetMetadata = Boolean(metadata && !stateRef.current.metadata);

      if (!hasPayload && !shouldSetMetadata) {
        return { changed: false, addedEarlier: false, addedLater: false, hasFramesAfter };
      }

      // Check if any of the new frames indicate a terminal game state
      let hasTerminalState = false;
      for (const frame of windowFrames) {
        if (isTerminalGameState(frame.gameState)) {
          hasTerminalState = true;
          break;
        }
      }

      setFrameState((prev) => {
        const nextWindow = new Map(prev.framesWindow);
        const nextDetails = new Map(prev.framesDetails);
        const timestampSet = new Set(prev.orderedTimestamps);
        const prevLatestTs =
          prev.orderedTimestamps.length > 0
            ? prev.orderedTimestamps[prev.orderedTimestamps.length - 1]
            : null;
        const prevDisplayTs =
          prev.displayIndex >= 0 && prev.displayIndex < prev.orderedTimestamps.length
            ? prev.orderedTimestamps[prev.displayIndex]
            : null;
        
        // Store the current timestamp to maintain position during backfill
        // This is especially important for live mode where we want to stay at the same point in time
        const currentTimestampToMaintain = prev.playbackPointer !== null
          ? prev.orderedTimestamps[prev.playbackPointer]
          : prevDisplayTs;
          
        // For live mode, we also want to track the latest timestamp to ensure we don't go backwards
        const prevLatestTimestamp = prev.orderedTimestamps.length > 0
          ? prev.orderedTimestamps[prev.orderedTimestamps.length - 1]
          : null;

        windowFrames.forEach((frame) => {
          const epoch = toEpochMillis(frame.rfc460Timestamp);
          if (!prev.framesWindow.has(epoch) && !prev.framesDetails.has(epoch)) {
            if (prevLatestTs === null || epoch > prevLatestTs) {
              newLaterFrames.add(epoch);
            }
          }
          nextWindow.set(epoch, frame);
          timestampSet.add(epoch);
        });

        detailFrames.forEach((frame) => {
          const epoch = toEpochMillis(frame.rfc460Timestamp);
          if (!prev.framesWindow.has(epoch) && !prev.framesDetails.has(epoch)) {
            if (prevLatestTs === null || epoch > prevLatestTs) {
              newLaterFrames.add(epoch);
            }
          }
          nextDetails.set(epoch, frame);
          timestampSet.add(epoch);
        });

        const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);
        hasFramesAfter = sortedTimestamps.length > 0;

        let metadataToUse = prev.metadata;
        let metadataMutated = false;
        if (!metadataToUse && metadata) {
          metadataToUse = metadata;
          metadataMutated = true;
        }

        let timestampsChanged =
          sortedTimestamps.length !== prev.orderedTimestamps.length;
        if (!timestampsChanged) {
          for (let i = 0; i < sortedTimestamps.length; i += 1) {
            if (sortedTimestamps[i] !== prev.orderedTimestamps[i]) {
              timestampsChanged = true;
              break;
            }
          }
        }

        if (!hasPayload && !timestampsChanged && !metadataMutated) {
          changed = false;
          addedEarlier = false;
          addedLater = false;
          return prev;
        }

        const prevEarliest =
          prev.orderedTimestamps.length > 0 ? prev.orderedTimestamps[0] : null;
        const prevLatest =
          prev.orderedTimestamps.length > 0
            ? prev.orderedTimestamps[prev.orderedTimestamps.length - 1]
            : null;

        // Determine if this merge added earlier or later frames before
        // adjusting indices, so we can preserve the visible timestamp.
        const didAddEarlier =
          sortedTimestamps.length > 0 &&
          (prevEarliest === null || sortedTimestamps[0] < prevEarliest);
        const didAddLater =
          sortedTimestamps.length > 0 &&
          (prevLatest === null ||
            sortedTimestamps[sortedTimestamps.length - 1] > prevLatest);

        const livePointer =
          sortedTimestamps.length > 0 ? sortedTimestamps.length - 1 : -1;

        let playbackPointer = prev.playbackPointer;
        if (prev.playbackPointer !== null) {
          const prevPointerTs = prev.orderedTimestamps[prev.playbackPointer];
          if (prevPointerTs !== undefined) {
            const newIndex = sortedTimestamps.indexOf(prevPointerTs);
            playbackPointer = newIndex === -1 ? null : newIndex;
          } else {
            playbackPointer = null;
          }
        }

        // Keep display index within bounds and initialize when we first get data
        let displayIndex = prev.displayIndex;
        if (sortedTimestamps.length === 0) {
          displayIndex = -1;
        } else {
          // When backfilling, we need to maintain the same timestamp position
          // not the same array index
          if (prevDisplayTs !== null) {
            const newIndex = sortedTimestamps.indexOf(prevDisplayTs);
            if (newIndex !== -1) {
              displayIndex = newIndex;
            } else if (prev.playbackPointer === null) {
              // In live mode, if we can't find the exact timestamp (shouldn't happen),
              // fall back to the latest frame to maintain live viewing
              displayIndex = livePointer;
              if (DEBUG_POLLING) {
                console.warn('Could not find previous display timestamp, falling back to live pointer', {
                  prevDisplayTs,
                  livePointer,
                  timestampsLength: sortedTimestamps.length
                });
              }
            }
          }
          if (displayIndex >= sortedTimestamps.length) {
            displayIndex = sortedTimestamps.length - 1;
          }
          if (displayIndex < 0 && playbackPointer === null && livePointer >= 0) {
            displayIndex = livePointer;
          }
          
          // Debug logging for display index changes
          if (DEBUG_POLLING && displayIndex !== prev.displayIndex) {
            console.log('Display index changed', {
              oldIndex: prev.displayIndex,
              newIndex: displayIndex,
              prevDisplayTs,
              newDisplayTs: displayIndex >= 0 ? sortedTimestamps[displayIndex] : null,
              addedEarlier,
              addedLater,
              isLiveMode: prev.playbackPointer === null
            });
          }
        }

        // Update play queue with any newly appended frames while in live mode
        let playQueue = prev.playQueue;
        if (prev.playbackPointer === null && newLaterFrames.size > 0) {
          const newLaterSorted = Array.from(newLaterFrames).sort((a, b) => a - b);
          const lastQueuedIndex =
            prev.playQueue.length > 0
              ? prev.playQueue[prev.playQueue.length - 1]
              : displayIndex >= 0
                ? displayIndex
                : livePointer;

          const newIndices: number[] = [];
          for (const ts of newLaterSorted) {
            const newIndex = sortedTimestamps.indexOf(ts);
            if (newIndex > lastQueuedIndex) {
              newIndices.push(newIndex);
            }
          }

          if (newIndices.length > 0) {
            const combinedQueue = [...prev.playQueue, ...newIndices];
            playQueue = Array.from(new Set(combinedQueue)).sort((a, b) => a - b);
            
            if (DEBUG_POLLING) {
              console.log('Updated play queue with new frames', {
                newFramesCount: newIndices.length,
                queueLength: playQueue.length,
                lastQueuedIndex,
                displayIndex
              });
            }
          }
        }
        
        // When backfill adds earlier frames, we need to adjust the existing play queue
        // to account for the shifted indices
        if (didAddEarlier && prev.playbackPointer === null && prev.playQueue.length > 0) {
          const adjustedQueue: number[] = [];
          for (const queueIndex of prev.playQueue) {
            const queueTimestamp = prev.orderedTimestamps[queueIndex];
            if (queueTimestamp !== undefined) {
              const newIndex = sortedTimestamps.indexOf(queueTimestamp);
              if (newIndex !== -1) {
                adjustedQueue.push(newIndex);
              }
            }
          }
          
          // Sort the adjusted queue to maintain order
          playQueue = adjustedQueue.sort((a, b) => a - b);
          
          if (DEBUG_POLLING && adjustedQueue.length !== prev.playQueue.length) {
            console.log('Adjusted play queue after backfill', {
              oldQueueLength: prev.playQueue.length,
              newQueueLength: adjustedQueue.length,
              addedEarlierCount: sortedTimestamps.length - prev.orderedTimestamps.length
            });
          }
        }
        
        // Special handling for backfill: if we added earlier frames and we're in live mode,
        // we need to ensure the display index points to the same timestamp, not the same array position
        if (didAddEarlier && prev.playbackPointer === null && currentTimestampToMaintain !== null) {
          const maintainedIndex = sortedTimestamps.indexOf(currentTimestampToMaintain);
          if (maintainedIndex !== -1) {
            displayIndex = maintainedIndex;
            if (DEBUG_POLLING) {
              console.log('Backfill: Maintained timestamp position', {
                currentTimestampToMaintain,
                oldIndex: prev.displayIndex,
                newIndex: maintainedIndex,
                timestampsBefore: prev.orderedTimestamps.length,
                timestampsAfter: sortedTimestamps.length,
                prevLatestTimestamp
              });
            }
          } else {
            if (DEBUG_POLLING) {
              console.error('Backfill: Could not find maintained timestamp in sorted timestamps', {
                currentTimestampToMaintain,
                sortedTimestamps: sortedTimestamps.slice(0, 10)
              });
            }
          }
        }
        
        // Additional safety check: in live mode, never let the display index go backwards in time
        if (prev.playbackPointer === null && prevDisplayTs !== null && displayIndex >= 0) {
          const currentDisplayTimestamp = sortedTimestamps[displayIndex];
          if (currentDisplayTimestamp < prevDisplayTs) {
            // Ensure we never rewind the visible frame during backfill
            const safeIndex = sortedTimestamps.indexOf(prevDisplayTs);
            if (safeIndex !== -1) {
              displayIndex = safeIndex;
            }
            if (DEBUG_POLLING) {
              console.warn('Backfill: Corrected rewind to preserve displayed timestamp', {
                currentDisplayTimestamp,
                prevDisplayTs,
                correctedTo: safeIndex !== -1 ? sortedTimestamps[safeIndex] : null
              });
            }
          }
        }

        changed = true;
        // Propagate earlier/later flags based on our precomputed values
        addedEarlier = didAddEarlier;
        addedLater = didAddLater;

        // Update isFinal flag if we detected a terminal state
        // Also consider any existing in-memory frames that already indicate a terminal state
        let existingTerminal = prev.isFinal;
        if (!existingTerminal) {
          for (const f of nextWindow.values()) {
            if (isTerminalGameState(f.gameState)) {
              existingTerminal = true;
              break;
            }
          }
        }
        const nextIsFinal = existingTerminal || hasTerminalState;

        return {
          ...prev,
          framesWindow: nextWindow,
          framesDetails: nextDetails,
          orderedTimestamps: sortedTimestamps,
          livePointer,
          playbackPointer,
          displayIndex,
          metadata: metadataToUse,
          isFinal: nextIsFinal,
          playQueue,
        };
      });

      return { changed, addedEarlier, addedLater, hasFramesAfter };
    },
    [setFrameState]
  );

  const markHasFirstFrame = useCallback(() => {
    setFrameState((prev) => {
      if (prev.hasFirstFrame) {
        if (prev.isBackfilling) {
          return { ...prev, isBackfilling: false };
        }
        return prev;
      }
      return { ...prev, hasFirstFrame: true, isBackfilling: false };
    });
    backfillCursorRef.current = null;
  }, [setFrameState]);

  // Live playback scheduler functions
  const stopScheduler = useCallback(() => {
    if (schedulerTimerRef.current) {
      clearTimeout(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    // driftCheckTimerRef cleanup is no longer needed
  }, []);

  const showNextFrame = useCallback(() => {
    if (!isMountedRef.current) return;

    setFrameState(prev => {
      // For manual mode, we need to advance the playback pointer
      if (prev.playbackPointer !== null) {
        const nextIndex = prev.playbackPointer + 1;
        const livePtr = prev.livePointer;
        if (nextIndex <= livePtr) {
          return {
            ...prev,
            playbackPointer: nextIndex,
            displayIndex: nextIndex
          };
        }
        // Reached last frame. If game is not finished, auto-switch to live; otherwise pause.
        if (!prev.isFinal) {
          return {
            ...prev,
            playbackPointer: null,
            displayIndex: prev.livePointer,
            isLivePaused: false,
          };
        }
        return {
          ...prev,
          isLivePaused: true,
        };
      }
      
      // For live mode, use the play queue
      if (prev.playQueue.length === 0 || prev.isLivePaused) {
        return prev;
      }

      const nextIndex = prev.playQueue[0];
      const newPlayQueue = prev.playQueue.slice(1);
      
      return {
        ...prev,
        displayIndex: nextIndex,
        playQueue: newPlayQueue
      };
    });
  }, []);

  const scheduleNextFrame = useCallback(() => {
    if (!isMountedRef.current) return;

    const currentState = stateRef.current;
    
    // For manual mode, check if we can advance
    if (currentState.playbackPointer !== null) {
      if (currentState.isLivePaused || currentState.playbackPointer >= currentState.livePointer) {
        schedulerTimerRef.current = null;
        return;
      }
      
      const nextIndex = currentState.playbackPointer + 1;
      const nextTs = currentState.orderedTimestamps[nextIndex];
      const currentTs = currentState.orderedTimestamps[currentState.playbackPointer];
      
      if (nextTs === undefined || currentTs === undefined) {
        schedulerTimerRef.current = null;
        return;
      }

      const rawDelta = nextTs - currentTs;
      const adjustedDelta = rawDelta > 0 ? rawDelta / currentState.speedFactor : MIN_FRAME_MS;
      const dt = Math.max(MIN_FRAME_MS, Math.min(MAX_FRAME_MS, adjustedDelta));

      schedulerTimerRef.current = setTimeout(() => {
        showNextFrame();
        scheduleNextFrame();
      }, dt);
      return;
    }
    
    // For live mode, use the play queue
    if (
      currentState.playQueue.length === 0 ||
      currentState.isLivePaused
    ) {
      schedulerTimerRef.current = null;
      return;
    }

    const nextIndex = currentState.playQueue[0];
    const nextTs = currentState.orderedTimestamps[nextIndex];

    if (nextTs === undefined) {
      schedulerTimerRef.current = null;
      return;
    }

    const previousIndex =
      currentState.displayIndex >= 0
        ? currentState.displayIndex
        : nextIndex - 1;
    const previousTs =
      previousIndex >= 0
        ? currentState.orderedTimestamps[previousIndex]
        : undefined;

    const rawDelta = previousTs !== undefined ? nextTs - previousTs : MIN_FRAME_MS;
    const adjustedDelta =
      rawDelta > 0 ? rawDelta / currentState.speedFactor : MIN_FRAME_MS;
    const dt = Math.max(
      MIN_FRAME_MS,
      Math.min(MAX_FRAME_MS, adjustedDelta)
    );

    schedulerTimerRef.current = setTimeout(() => {
      showNextFrame();
      scheduleNextFrame();
    }, dt);
  }, [showNextFrame]);

  const startScheduler = useCallback(() => {
    if (schedulerTimerRef.current !== null) return; // Already running

    // Set up anchors for timing calculation
    const now = Date.now();
    anchorWallRef.current = now;
    
    const currentState = stateRef.current;
    if (currentState.orderedTimestamps.length > 0) {
      // Use the timestamp of the frame we're currently displaying as anchor
      const displayTs = currentState.displayIndex >= 0 ?
        currentState.orderedTimestamps[currentState.displayIndex] :
        currentState.orderedTimestamps[0];
      anchorTsRef.current = displayTs;
    }

    // Drift checking has been removed to prevent automatic speed adjustments
    // Speed should only change via explicit user input

    scheduleNextFrame();
  }, [scheduleNextFrame]);

  // Playback control functions
  const pauseLive = useCallback(() => {
    stopScheduler();
    setFrameState(prev => ({ ...prev, isLivePaused: true }));
  }, [stopScheduler]);

  const resumeLive = useCallback(() => {
    setFrameState(prev => ({ ...prev, isLivePaused: false }));
    startScheduler();
  }, [startScheduler]);

  const setDesiredLagMs = useCallback((ms: number) => {
    setFrameState(prev => ({ ...prev, desiredLagMs: ms }));
  }, []);

  const setSpeedFactor = useCallback((factor: number) => {
    setFrameState(prev => ({ ...prev, speedFactor: Math.max(0.5, Math.min(MAX_SPEED_FACTOR, factor)) }));
  }, []);

  const fetchChunk = useCallback(
    async (startingTime: string, signal?: AbortSignal) => {
      if (!gameId) {
        return { windowFrames: [] as FrameWindow[], detailFrames: [] as FrameDetails[], metadata: undefined as GameMetadata | undefined };
      }

      const [windowResponse, detailsResponse] = await Promise.all([
        getLiveWindowGame(gameId, startingTime, signal),
        getLiveDetailsGame(gameId, startingTime, signal),
      ]);

      const windowFrames: FrameWindow[] = windowResponse.data?.frames ?? [];
      const detailFrames: FrameDetails[] = detailsResponse.data?.frames ?? [];
      const metadata: GameMetadata | undefined = windowResponse.data?.gameMetadata;

      return { windowFrames, detailFrames, metadata };
    },
    [gameId]
  );

  /**
   * Fetches a batch of timestamps with deduplication
   * Marks timestamps as requested BEFORE fetching to prevent duplicate requests
   */
  const fetchTimestampBatch = useCallback(async (
    timestamps: number[],
    signal?: AbortSignal
  ): Promise<{ hadNewData: boolean; hadAnyData: boolean }> => {
    if (timestamps.length === 0) return { hadNewData: false, hadAnyData: false };

    // Mark all timestamps as requested BEFORE fetching to prevent duplicates
    setFrameState(prev => {
      const newRequested = new Set(prev.requestedTimestamps);
      timestamps.forEach(ts => newRequested.add(ts));
      return { ...prev, requestedTimestamps: newRequested };
    });

    const fetchPromises = timestamps.map(async (targetCursor) => {
      const targetTime = toISO(new Date(targetCursor));
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount <= maxRetries) {
        if (cancelBackfillRef.current || signal?.aborted) {
          throw new Error('Backfill cancelled');
        }

        try {
          const chunk = await fetchChunk(targetTime, signal);
          return { chunk, targetCursor };
        } catch (error) {
          retryCount++;
          if (retryCount > maxRetries || cancelBackfillRef.current) {
            if (DEBUG_POLLING) {
              console.warn(`Backfill chunk failed after ${maxRetries} retries:`, error);
            }
            // Mark as failed
            setFrameState(prev => {
              const newFailed = new Set(prev.failedTimestamps);
              newFailed.add(targetCursor);
              return { ...prev, failedTimestamps: newFailed };
            });
            return null;
          }

          const baseDelay = BACKFILL_RETRY_DELAY_MS;
          const exponentialDelay = baseDelay * Math.pow(2, retryCount - 1);
          const jitter = Math.random() * 100;
          await delay(exponentialDelay + jitter);
        }
      }

      return null;
    });

    const results = await Promise.allSettled(fetchPromises);

    let hadNewData = false;
    let hadAnyData = false;

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        const { chunk } = result.value;
        const { windowFrames, detailFrames, metadata } = chunk;

        if (windowFrames.length > 0 || detailFrames.length > 0) {
          hadAnyData = true;
          const mergeResult = mergeFrames(windowFrames, detailFrames, metadata);
          if (mergeResult.changed) {
            hadNewData = true;
          }
        }
      }
    }

    return { hadNewData, hadAnyData };
  }, [fetchChunk, mergeFrames, setFrameState]);

  /**
   * Phase 1: Sparse backfill at 60-second intervals
   */
  const runSparseBackfill = useCallback(async () => {
    const currentState = stateRef.current;
    if (currentState.orderedTimestamps.length === 0) return;

    const anchorTs = currentState.orderedTimestamps[0];
    const minTs = anchorTs - MAX_BACKFILL_RANGE_MS;

    // Generate sparse timestamps going backward
    const sparseTimestamps = generateSparseTimestamps(anchorTs, SPARSE_STEP_MS, 120); // 2 hours of sparse data

    // Filter out already-requested timestamps
    const toFetch = sparseTimestamps.filter(
      ts => ts >= minTs && !currentState.requestedTimestamps.has(ts)
    );

    if (DEBUG_POLLING) console.log(`Sparse phase: fetching ${toFetch.length} timestamps`);

    // Fetch in batches with increased concurrency
    for (let i = 0; i < toFetch.length; i += MAX_IN_FLIGHT) {
      if (cancelBackfillRef.current || stateRef.current.hasFirstFrame) break;

      const batch = toFetch.slice(i, i + MAX_IN_FLIGHT);
      await fetchTimestampBatch(batch, backfillAbortControllerRef.current?.signal);

      // Short delay between batches
      if (i + MAX_IN_FLIGHT < toFetch.length) {
        await delay(BATCH_DELAY_MS);
      }
    }
  }, [fetchTimestampBatch]);

  /**
   * Phase 2: Medium density backfill at 30-second intervals
   */
  const runMediumBackfill = useCallback(async () => {
    const currentState = stateRef.current;
    if (currentState.orderedTimestamps.length === 0) return;

    const gaps = detectGaps(currentState.orderedTimestamps, DENSE_STEP_MS);

    // Generate 30-second interval timestamps for larger gaps
    const mediumTimestamps: number[] = [];
    for (const gap of gaps) {
      if (gap.missingCount > 3) {
        // Add 30-second samples within the gap
        let ts = gap.start + MEDIUM_STEP_MS;
        while (ts < gap.end) {
          if (!currentState.requestedTimestamps.has(ts)) {
            mediumTimestamps.push(ts);
          }
          ts += MEDIUM_STEP_MS;
        }
      }
    }

    if (DEBUG_POLLING) console.log(`Medium phase: fetching ${mediumTimestamps.length} timestamps`);

    // Fetch in batches
    for (let i = 0; i < mediumTimestamps.length; i += MAX_IN_FLIGHT) {
      if (cancelBackfillRef.current || stateRef.current.hasFirstFrame) break;

      const batch = mediumTimestamps.slice(i, i + MAX_IN_FLIGHT);
      await fetchTimestampBatch(batch, backfillAbortControllerRef.current?.signal);

      if (i + MAX_IN_FLIGHT < mediumTimestamps.length) {
        await delay(BATCH_DELAY_MS);
      }
    }
  }, [fetchTimestampBatch]);

  /**
   * Phase 3: Dense backfill at 10-second intervals with gap detection
   */
  const runDenseBackfill = useCallback(async () => {
    while (!stateRef.current.hasFirstFrame && !cancelBackfillRef.current && isMountedRef.current) {
      const currentState = stateRef.current;
      if (currentState.orderedTimestamps.length === 0) break;

      const gaps = detectGaps(currentState.orderedTimestamps, DENSE_STEP_MS);

      if (gaps.length === 0) {
        // No gaps - try extending backward to find earlier frames
        const earliestTs = currentState.orderedTimestamps[0];
        const toFetch: number[] = [];

        for (let i = 1; i <= BACKFILL_CONCURRENCY; i++) {
          const ts = earliestTs - (DENSE_STEP_MS * i);
          if (!currentState.requestedTimestamps.has(ts)) {
            toFetch.push(ts);
          }
        }

        if (toFetch.length === 0) {
          markHasFirstFrame();
          break;
        }

        const { hadAnyData } = await fetchTimestampBatch(toFetch, backfillAbortControllerRef.current?.signal);
        if (!hadAnyData) {
          // No data returned - we've reached the beginning
          markHasFirstFrame();
          break;
        }
      } else {
        // Fill gaps, prioritizing earlier gaps first
        gaps.sort((a, b) => a.start - b.start);

        const toFetch: number[] = [];
        for (const gap of gaps.slice(0, 3)) {
          const gapTimestamps = generateGapFillTimestamps(gap.start, gap.end, DENSE_STEP_MS);
          for (const ts of gapTimestamps) {
            if (!currentState.requestedTimestamps.has(ts)) {
              toFetch.push(ts);
            }
            if (toFetch.length >= MAX_IN_FLIGHT) break;
          }
          if (toFetch.length >= MAX_IN_FLIGHT) break;
        }

        if (toFetch.length === 0) {
          markHasFirstFrame();
          break;
        }

        await fetchTimestampBatch(toFetch, backfillAbortControllerRef.current?.signal);
      }

      // Ensure scheduler continues running during backfill
      if (stateRef.current.orderedTimestamps.length > 0 &&
          stateRef.current.playbackPointer === null &&
          !stateRef.current.isLivePaused &&
          schedulerTimerRef.current === null) {
        startScheduler();
      }

      await delay(BATCH_DELAY_MS);
    }
  }, [fetchTimestampBatch, markHasFirstFrame, startScheduler]);

  /**
   * Multi-phase backfill strategy:
   * 1. Sparse phase (60s intervals) - quick timeline coverage
   * 2. Medium phase (30s intervals) - fill larger gaps
   * 3. Dense phase (10s intervals) - full resolution with gap detection
   */
  const runBackfill = useCallback(async () => {
    if (!gameId) return;
    if (backfillRunningRef.current) return;

    backfillRunningRef.current = true;
    cancelBackfillRef.current = false;
    backfillAbortControllerRef.current = new AbortController();

    setFrameState(prev => ({
      ...prev,
      isBackfilling: true,
      backfillPhase: 'sparse'
    }));

    try {
      // === PHASE 1: Sparse sampling at 60-second intervals ===
      if (DEBUG_POLLING) console.log('Backfill Phase 1: Sparse sampling');
      await runSparseBackfill();

      if (cancelBackfillRef.current || stateRef.current.hasFirstFrame) {
        return;
      }

      // === PHASE 2: Medium density at 30-second intervals ===
      if (DEBUG_POLLING) console.log('Backfill Phase 2: Medium density');
      setFrameState(prev => ({ ...prev, backfillPhase: 'medium' }));
      await runMediumBackfill();

      if (cancelBackfillRef.current || stateRef.current.hasFirstFrame) {
        return;
      }

      // === PHASE 3: Dense fill with gap detection ===
      if (DEBUG_POLLING) console.log('Backfill Phase 3: Dense fill');
      setFrameState(prev => ({ ...prev, backfillPhase: 'dense' }));
      await runDenseBackfill();

    } finally {
      backfillRunningRef.current = false;
      backfillStartedRef.current = stateRef.current.hasFirstFrame;
      backfillAbortControllerRef.current = null;
      setFrameState(prev => ({
        ...prev,
        isBackfilling: false,
        backfillPhase: prev.hasFirstFrame ? 'complete' : prev.backfillPhase
      }));

      // Ensure scheduler is running after backfill
      if (stateRef.current.orderedTimestamps.length > 0 &&
          stateRef.current.playbackPointer === null &&
          !stateRef.current.isLivePaused &&
          schedulerTimerRef.current === null) {
        startScheduler();
      }
    }
  }, [gameId, runSparseBackfill, runMediumBackfill, runDenseBackfill, setFrameState, startScheduler]);


  const startLivePolling = useCallback(() => {
    if (!gameId) {
      return;
    }

    // Clear any existing interval/timeout
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (DEBUG_POLLING) {
      console.log('Starting live polling for game:', gameId);
    }

    const scheduleNextPoll = (delayMs: number) => {
      if (!isMountedRef.current || cancelBackfillRef.current) return;
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      pollIntervalRef.current = setTimeout(poll, delayMs);
    };

    const handleTerminalState = () => {
      setFrameState(prev => ({ ...prev, isFinal: true }));

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      if (finalStateBackoffRef.current) {
        clearTimeout(finalStateBackoffRef.current);
      }

      // Use exponential backoff based on consecutive empty responses
      const backoffMultiplier = Math.min(stateRef.current.consecutiveEmptyResponses, 5);
      const backoffMs = FINAL_STATE_BACKOFF_MS * Math.max(1, backoffMultiplier);

      finalStateBackoffRef.current = setTimeout(() => {
        if (!isMountedRef.current || cancelBackfillRef.current) {
          return;
        }
        if (DEBUG_POLLING) {
          console.log('Terminal state backoff expired - resuming polling');
        }
        // Reset detection state and resume polling
        setFrameState(prev => ({
          ...prev,
          isFinal: false,
          consecutiveEmptyResponses: 0,
          duplicateFrameCount: 0,
          lastFrameSignature: null
        }));
        startLivePolling();
      }, backoffMs);

      pollingInFlightRef.current = false;
    };

    const poll = async () => {
      if (pollingInFlightRef.current) {
        scheduleNextPoll(LIVE_POLL_INTERVAL_MS);
        return;
      }

      if (!isMountedRef.current || cancelBackfillRef.current) {
        if (DEBUG_POLLING) {
          console.log('Stopping polling - component unmounted or cancelled');
        }
        return;
      }

      pollingInFlightRef.current = true;

      // If any existing in-memory frame indicates a terminal state, stop polling immediately
      if (!stateRef.current.isFinal) {
        let anyTerminal = false;
        for (const f of stateRef.current.framesWindow.values()) {
          if (isTerminalGameState(f.gameState)) {
            anyTerminal = true;
            break;
          }
        }
        if (anyTerminal) {
          if (DEBUG_POLLING) {
            console.log('Detected terminal state from in-memory frames - stopping polling');
          }
          // Mark as final and stop polling with backoff (reuse existing logic)
          setFrameState(prev => ({ ...prev, isFinal: true }));

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            clearTimeout(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          if (finalStateBackoffRef.current) {
            clearTimeout(finalStateBackoffRef.current);
          }

          finalStateBackoffRef.current = setTimeout(() => {
            if (!isMountedRef.current || cancelBackfillRef.current) {
              return;
            }
            if (DEBUG_POLLING) {
              console.log('Backoff timer triggered after in-memory terminal detection - resuming polling');
            }
            setFrameState(prev => ({ ...prev, isFinal: false }));
            startLivePolling();
          }, FINAL_STATE_BACKOFF_MS);

          pollingInFlightRef.current = false;
          return;
        }
      }

      // Stop polling if the game is in a terminal state
      if (stateRef.current.isFinal) {
        if (DEBUG_POLLING) {
          console.log('Stopping polling - game in terminal state');
        }
        
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          clearTimeout(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        // Set up a backoff timer to retry after a delay (in case the game resumes)
        if (finalStateBackoffRef.current) {
          clearTimeout(finalStateBackoffRef.current);
        }
        
        if (DEBUG_POLLING) {
          console.log('Setting up backoff timer for terminal state');
        }
        
        finalStateBackoffRef.current = setTimeout(() => {
          if (!isMountedRef.current || cancelBackfillRef.current) {
            return;
          }
          
          if (DEBUG_POLLING) {
            console.log('Backoff timer triggered - resuming polling');
          }
          
          // Reset isFinal flag and resume polling
          setFrameState(prev => ({ ...prev, isFinal: false }));
          startLivePolling();
        }, FINAL_STATE_BACKOFF_MS);
        
        pollingInFlightRef.current = false;
        return;
      }

      try {
        // Abort any previous in-flight forward request before starting a new one
        if (forwardAbortControllerRef.current) {
          forwardAbortControllerRef.current.abort();
        }
        forwardAbortControllerRef.current = new AbortController();

        const { windowFrames, detailFrames, metadata } = await fetchChunk(
          getISODateMultiplyOf10(),
          forwardAbortControllerRef.current.signal
        );

        // Track empty responses for terminal detection
        if (windowFrames.length === 0 && detailFrames.length === 0) {
          const newEmptyCount = stateRef.current.consecutiveEmptyResponses + 1;
          setFrameState(prev => ({ ...prev, consecutiveEmptyResponses: newEmptyCount }));

          if (newEmptyCount >= EMPTY_RESPONSE_THRESHOLD) {
            if (DEBUG_POLLING) {
              console.log(`Detected ${newEmptyCount} consecutive empty responses - stopping polling`);
            }
            handleTerminalState();
            return;
          }
        } else {
          // Reset empty response counter when we get data
          if (stateRef.current.consecutiveEmptyResponses > 0) {
            setFrameState(prev => ({ ...prev, consecutiveEmptyResponses: 0 }));
          }
        }

        // Check for duplicate frames (game stagnation detection)
        if (windowFrames.length > 0) {
          const latestFrame = windowFrames[windowFrames.length - 1];
          const signature = computeFrameSignature(latestFrame);

          if (signature === stateRef.current.lastFrameSignature && signature !== '') {
            const newDuplicateCount = stateRef.current.duplicateFrameCount + 1;
            setFrameState(prev => ({ ...prev, duplicateFrameCount: newDuplicateCount }));

            if (newDuplicateCount >= DUPLICATE_THRESHOLD) {
              if (DEBUG_POLLING) {
                console.log(`Detected ${newDuplicateCount} consecutive duplicate frames - stopping polling`);
              }
              handleTerminalState();
              return;
            }
          } else {
            // Reset duplicate counter when frame changes
            if (stateRef.current.duplicateFrameCount > 0) {
              setFrameState(prev => ({ ...prev, duplicateFrameCount: 0 }));
            }
            // Update signature
            setFrameState(prev => ({ ...prev, lastFrameSignature: signature }));
          }
        }

        mergeFrames(windowFrames, detailFrames, metadata);

        // Start scheduler if we have frames and we're in live mode
        // Continue running even during backfill
        if (stateRef.current.orderedTimestamps.length > 0 &&
            stateRef.current.playbackPointer === null &&
            !stateRef.current.isLivePaused &&
            schedulerTimerRef.current === null) {
          startScheduler();
        }

        // Periodically check for and fill small gaps (fire-and-forget)
        if (stateRef.current.orderedTimestamps.length > 0 &&
            !stateRef.current.isBackfilling &&
            stateRef.current.orderedTimestamps.length < 500) { // Only if not too many frames
          const gaps = detectGaps(stateRef.current.orderedTimestamps, DENSE_STEP_MS);
          const smallGaps = gaps.filter(g => g.missingCount <= 5 && g.missingCount > 0);

          if (smallGaps.length > 0) {
            const toFill = smallGaps
              .slice(0, 2) // Only process first 2 gaps per poll
              .flatMap(g => generateGapFillTimestamps(g.start, g.end, DENSE_STEP_MS))
              .filter(ts => !stateRef.current.requestedTimestamps.has(ts))
              .slice(0, 10); // Limit to 10 timestamps per poll

            if (toFill.length > 0) {
              // Fire-and-forget gap fill - don't await
              fetchTimestampBatch(toFill, backfillAbortControllerRef.current?.signal).catch(() => {
                // Silently ignore gap fill errors
              });
            }
          }
        }

        // If after merging frames we detect a terminal state, stop polling
        if (stateRef.current.isFinal && pollIntervalRef.current) {
          if (DEBUG_POLLING) {
            console.log('Detected terminal state after merge - stopping polling');
          }
          clearInterval(pollIntervalRef.current);
          clearTimeout(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } catch {
        if (DEBUG_POLLING) {
          console.log('Error in polling, will retry');
        }
        // swallow errors; next poll will retry
      } finally {
        // Schedule next poll only after this one finishes, to avoid overlap
        if (isMountedRef.current && !cancelBackfillRef.current && !stateRef.current.isFinal) {
          scheduleNextPoll(LIVE_POLL_INTERVAL_MS);
        }
        pollingInFlightRef.current = false;
      }
    };

    void poll();
  }, [fetchChunk, fetchTimestampBatch, gameId, mergeFrames, setFrameState, startScheduler]);

  // Ensure backfill starts whenever conditions allow, even if forward polling is stopped.
  // Do not flip hasFirstFrame here; only start if we haven't reached the earliest frame.
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (!isBackfillEnabled) return;
    if (backfillRunningRef.current || backfillStartedRef.current) return;
    if (state.orderedTimestamps.length === 0) return;
    if (state.hasFirstFrame) return;

    // Reset cancel flag in case it was set when backfill was disabled
    cancelBackfillRef.current = false;

    backfillStartedRef.current = true;
    void runBackfill();
  }, [isBackfillEnabled, state.orderedTimestamps.length, state.hasFirstFrame, gameId, runBackfill]);

  useEffect(() => {
    // Clean up any existing polling and backoff timers
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      clearTimeout(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (finalStateBackoffRef.current) {
      clearTimeout(finalStateBackoffRef.current);
      finalStateBackoffRef.current = null;
    }
    
    cancelBackfillRef.current = true;
    backfillRunningRef.current = false;
    backfillStartedRef.current = false;
    backfillCursorRef.current = null;
    
    // Cancel any ongoing backfill requests
    if (backfillAbortControllerRef.current) {
      backfillAbortControllerRef.current.abort();
      backfillAbortControllerRef.current = null;
    }

    if (!gameId) {
      backfillStartedRef.current = false;
      setFrameState(() => createInitialState());
      return;
    }

    // Reset for new game
    cancelBackfillRef.current = false;
    backfillStartedRef.current = false;
    backfillCursorRef.current = null;
    setFrameState(() => createInitialState());

    const initialize = async () => {
      try {
        // Initial forward fetch only; do not trigger backfill here
        const { windowFrames, detailFrames, metadata } = await fetchChunk(
          getISODateMultiplyOf10()
        );
        mergeFrames(windowFrames, detailFrames, metadata);
      } catch {
        // ignore errors; live polling will continue attempts
      } finally {
        startLivePolling();
      }
    };

    void initialize();

    return () => {
      cancelBackfillRef.current = true;
      backfillRunningRef.current = false;
      backfillCursorRef.current = null;
      
      // Cancel any ongoing backfill requests
      if (backfillAbortControllerRef.current) {
        backfillAbortControllerRef.current.abort();
        backfillAbortControllerRef.current = null;
      }
      
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (finalStateBackoffRef.current) {
        clearTimeout(finalStateBackoffRef.current);
        finalStateBackoffRef.current = null;
      }
    };
  }, [fetchChunk, gameId, mergeFrames, setFrameState, startLivePolling]);

  const goLive = useCallback(() => {
    setFrameState((prev) => {
      if (prev.playbackPointer === null) {
        return prev;
      }
      // Reset display index to latest and resume live playback
      // Keep the current speed factor and other settings
      return {
        ...prev,
        playbackPointer: null,
        displayIndex: prev.livePointer,
        isLivePaused: false
        // speedFactor is preserved from prev
      };
    });
    
    // Start the scheduler when going live
    if (schedulerTimerRef.current === null) {
      startScheduler();
    }
  }, [startScheduler]);

  const setPlaybackByEpoch = useCallback(
    (epoch: number) => {
      setFrameState((prev) => {
        if (prev.orderedTimestamps.length === 0) {
          return prev;
        }
        const index = findClosestTimestampIndex(prev.orderedTimestamps, epoch);
        if (index < 0) {
          return prev;
        }
        if (prev.playbackPointer === index) {
          return prev;
        }
        // Stop scheduler when switching to scrub mode
        stopScheduler();
        return {
          ...prev,
          playbackPointer: index,
          displayIndex: index,
          // Enter manual mode paused so the play button starts playback
          isLivePaused: true
        };
      });
    },
    [setFrameState, stopScheduler]
  );

  // Determine the current index based on mode
  const currentIndex =
    state.playbackPointer !== null
      ? state.playbackPointer
      : state.displayIndex >= 0
        ? state.displayIndex
        : state.livePointer;
    
  const currentTimestamp =
    currentIndex >= 0 && currentIndex < state.orderedTimestamps.length
      ? state.orderedTimestamps[currentIndex]
      : null;

  const currentWindow =
    currentTimestamp !== null
      ? state.framesWindow.get(currentTimestamp)
      : undefined;

  let currentDetails =
    currentTimestamp !== null
      ? state.framesDetails.get(currentTimestamp)
      : undefined;

  if (!currentDetails && currentTimestamp !== null) {
    const previousTs =
      currentIndex - 1 >= 0 ? state.orderedTimestamps[currentIndex - 1] : undefined;
    const nextTs =
      currentIndex + 1 < state.orderedTimestamps.length
        ? state.orderedTimestamps[currentIndex + 1]
        : undefined;
    currentDetails =
      (previousTs !== undefined
        ? state.framesDetails.get(previousTs)
        : undefined) ??
      (nextTs !== undefined ? state.framesDetails.get(nextTs) : undefined);
  }

  const selectedTimestamp =
    state.playbackPointer !== null && state.playbackPointer >= 0
      ? state.orderedTimestamps[state.playbackPointer] ?? null
      : null;

  const displayedTs =
    state.displayIndex >= 0 && state.displayIndex < state.orderedTimestamps.length
      ? state.orderedTimestamps[state.displayIndex]
      : null;

  const orderedWindowFrames = useMemo(() => {
    return state.orderedTimestamps
      .map((ts) => state.framesWindow.get(ts))
      .filter((frame): frame is FrameWindow => Boolean(frame));
  }, [state.orderedTimestamps, state.framesWindow]);

  const orderedDetailFrames = useMemo(() => {
    return state.orderedTimestamps
      .map((ts) => state.framesDetails.get(ts))
      .filter((frame): frame is FrameDetails => Boolean(frame));
  }, [state.orderedTimestamps, state.framesDetails]);

  return {
    currentWindow,
    currentDetails,
    currentMetadata: state.metadata,
    windowFrames: orderedWindowFrames,
    detailFrames: orderedDetailFrames,
    timestamps: state.orderedTimestamps,
    hasFirstFrame: state.hasFirstFrame,
    isBackfilling: state.isBackfilling,
    isLive: state.playbackPointer === null,
    isFinal: state.isFinal,
    selectedTimestamp,
    currentTimestamp,
    goLive,
    setPlaybackByEpoch,
    
    // Live playback controls
    isLivePaused: state.isLivePaused,
    desiredLagMs: state.desiredLagMs,
    speedFactor: state.speedFactor,
    displayedTs,
    pauseLive,
    resumeLive,
    setDesiredLagMs,
    setSpeedFactor,
  };
}
