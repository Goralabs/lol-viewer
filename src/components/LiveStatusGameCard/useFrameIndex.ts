import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Frame as FrameWindow, GameMetadata } from "./types/windowLiveTypes";
import { Frame as FrameDetails } from "./types/detailsLiveTypes";
import {
  getLiveWindowGame,
  getLiveDetailsGame,
  getISODateMultiplyOf10,
} from "../../utils/LoLEsportsAPI";
import {
  roundToPrevious10s,
  toISO,
  toEpochMillis,
  findClosestTimestampIndex,
  isTerminalGameState,
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

const BACKFILL_STEP_MS = 10_000;
const BACKFILL_DELAY_MS = 700; // Base delay between backfill batches
const BACKFILL_RETRY_DELAY_MS = 1_000;
const BACKFILL_CONCURRENCY = 10; // Bounded concurrency to avoid request spikes
const BACKFILL_BATCH_JITTER_MS = 50; // Small jitter between batches
const LIVE_POLL_INTERVAL_MS = 1000; // Reduce request rate for live polling
const FINAL_STATE_BACKOFF_MS = 60_000; // 1 minute backoff for finished games

// Live playback constants
const DEFAULT_DESIRED_LAG_MS = 10_000; // 10 seconds behind live
const MIN_FRAME_MS = 150; // Minimum time between frames
const MAX_FRAME_MS = 4000; // Maximum time between frames
// DRIFT_CHECK_INTERVAL_MS is no longer needed since we removed automatic speed adjustments
const MAX_SPEED_FACTOR = 10.0; // Maximum playback speed

// Debug logging flag
const DEBUG_POLLING = process.env.NODE_ENV === 'development';

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
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const runBackfill = useCallback(async () => {
    if (!gameId) return;
    if (backfillRunningRef.current) return;

    backfillRunningRef.current = true;
    cancelBackfillRef.current = false;
    // Create a controller to allow cancelling all in-flight backfill requests
    backfillAbortControllerRef.current = new AbortController();

    setFrameState((prev) =>
      prev.isBackfilling ? prev : { ...prev, isBackfilling: true }
    );

    try {
      while (isMountedRef.current && !cancelBackfillRef.current) {
        const currentState = stateRef.current;
        if (currentState.hasFirstFrame) {
          break;
        }
        if (currentState.orderedTimestamps.length === 0) {
          break;
        }

        // Initialize cursor if needed
        if (backfillCursorRef.current === null) {
          const anchorTs = currentState.orderedTimestamps[0];
          if (anchorTs === undefined) {
            break;
          }
          const roundedAnchor = roundToPrevious10s(new Date(anchorTs)).getTime();
          backfillCursorRef.current = roundedAnchor - BACKFILL_STEP_MS;
        }

        // Determine the timestamps to fetch based on concurrency, always stepping further back in time
        const targetTimestamps: number[] = [];
        const currentCursor = backfillCursorRef.current ?? 0;
        
        for (let i = 0; i < BACKFILL_CONCURRENCY; i++) {
          const targetCursor = currentCursor - (BACKFILL_STEP_MS * i);
          if (!Number.isFinite(targetCursor)) {
            break;
          }
          targetTimestamps.push(targetCursor);
        }

        if (targetTimestamps.length === 0) {
          markHasFirstFrame();
          break;
        }

        // Create fetch promises with retry logic
        const fetchPromises = targetTimestamps.map(async (targetCursor) => {
          const targetTime = toISO(new Date(targetCursor));
          let retryCount = 0;
          const maxRetries = 3;

          while (retryCount <= maxRetries) {
            // Check if we should abort before making the request
            if (cancelBackfillRef.current || backfillAbortControllerRef.current?.signal.aborted) {
              throw new Error('Backfill cancelled');
            }

            try {
              const chunk = await fetchChunk(targetTime, backfillAbortControllerRef.current?.signal);
              return { chunk, targetCursor };
            } catch (error) {
              retryCount++;
              if (retryCount > maxRetries || cancelBackfillRef.current) {
                // Log the error but don't fail the entire batch
                if (DEBUG_POLLING) {
                  console.warn(`Backfill chunk failed after ${maxRetries} retries:`, error);
                }
                return null;
              }
              
              // Exponential backoff with jitter
              const baseDelay = BACKFILL_RETRY_DELAY_MS;
              const exponentialDelay = baseDelay * Math.pow(2, retryCount - 1);
              const jitter = Math.random() * 100; // Add up to 100ms jitter
              await delay(exponentialDelay + jitter);
            }
          }
          
          return null;
        });

        // Wait for all fetches to complete (or fail)
        const results = await Promise.allSettled(fetchPromises);
        
        // Process successful results
        let anyProgress = false;
        let sawFrames = false;
        let earliestFetchedTimestamp = Number.POSITIVE_INFINITY;
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value !== null) {
            const { chunk, targetCursor } = result.value;
            const { windowFrames, detailFrames, metadata } = chunk;
            
            if (windowFrames.length > 0 || detailFrames.length > 0) {
              sawFrames = true;
              const mergeResult = mergeFrames(windowFrames, detailFrames, metadata);
              if (mergeResult.changed) {
                anyProgress = true;
              }
              if (targetCursor < earliestFetchedTimestamp) {
                earliestFetchedTimestamp = targetCursor;
              }
            }
          }
        }
        
        if (anyProgress) {
          const updatedEarliest = stateRef.current.orderedTimestamps[0];
          if (updatedEarliest === undefined) {
            markHasFirstFrame();
            break;
          }
          const rounded = roundToPrevious10s(new Date(updatedEarliest)).getTime();
          backfillCursorRef.current = rounded - BACKFILL_STEP_MS;
        } else {
          if (!sawFrames) {
            // All requests returned empty/204 – we've reached the beginning
            markHasFirstFrame();
            break;
          }

          const fallbackCursor = Number.isFinite(earliestFetchedTimestamp)
            ? earliestFetchedTimestamp - BACKFILL_STEP_MS
            : (() => {
                const updatedEarliest = stateRef.current.orderedTimestamps[0];
                return updatedEarliest !== undefined
                  ? roundToPrevious10s(new Date(updatedEarliest)).getTime() - BACKFILL_STEP_MS
                  : Number.NaN;
              })();

          if (!Number.isFinite(fallbackCursor)) {
            markHasFirstFrame();
            break;
          }

          backfillCursorRef.current = fallbackCursor;
        }
        
        // Ensure scheduler continues running during backfill if we're in live mode
        if (stateRef.current.orderedTimestamps.length > 0 &&
            stateRef.current.playbackPointer === null &&
            !stateRef.current.isLivePaused &&
            schedulerTimerRef.current === null) {
          startScheduler();
        }
        
        // Add jitter between batches to avoid overwhelming the API
        if (targetTimestamps.length === BACKFILL_CONCURRENCY) {
          await delay(BACKFILL_DELAY_MS + (Math.random() * BACKFILL_BATCH_JITTER_MS));
        } else {
          await delay(BACKFILL_DELAY_MS);
        }
      }
    } finally {
      backfillRunningRef.current = false;
      backfillStartedRef.current = stateRef.current.hasFirstFrame;
      backfillAbortControllerRef.current = null;
      setFrameState((prev) =>
        prev.isBackfilling ? { ...prev, isBackfilling: false } : prev
      );
      
      // Ensure scheduler is running after backfill completes if we're in live mode
      if (stateRef.current.orderedTimestamps.length > 0 &&
          stateRef.current.playbackPointer === null &&
          !stateRef.current.isLivePaused &&
          schedulerTimerRef.current === null) {
        startScheduler();
      }
    }
  }, [fetchChunk, gameId, markHasFirstFrame, mergeFrames, setFrameState, startScheduler]);


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
        mergeFrames(windowFrames, detailFrames, metadata);
        
        // Start scheduler if we have frames and we're in live mode
        // Continue running even during backfill
        if (stateRef.current.orderedTimestamps.length > 0 &&
            stateRef.current.playbackPointer === null &&
            !stateRef.current.isLivePaused &&
            schedulerTimerRef.current === null) {
          startScheduler();
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
  }, [fetchChunk, gameId, mergeFrames, setFrameState, startScheduler]);

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
