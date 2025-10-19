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
const BACKFILL_DELAY_MS = 200;
const BACKFILL_RETRY_DELAY_MS = 1_000;
const LIVE_POLL_INTERVAL_MS = 500;
const FINAL_STATE_BACKOFF_MS = 60_000; // 1 minute backoff for finished games

// Live playback constants
const DEFAULT_DESIRED_LAG_MS = 10_000; // 10 seconds behind live
const MIN_FRAME_MS = 150; // Minimum time between frames
const MAX_FRAME_MS = 4000; // Maximum time between frames
const DRIFT_CHECK_INTERVAL_MS = 5000; // Check drift every 5 seconds
const MAX_SPEED_FACTOR = 2.0; // Maximum playback speed

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
  const finalStateBackoffRef = useRef<NodeJS.Timeout | null>(null);
  
  // Live playback refs
  const schedulerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const anchorWallRef = useRef<number>(Date.now());
  const anchorTsRef = useRef<number>(0);
  const driftCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cancelBackfillRef.current = true;
      backfillRunningRef.current = false;
      backfillStartedRef.current = false;
      backfillCursorRef.current = null;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
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
      if (driftCheckTimerRef.current) {
        clearInterval(driftCheckTimerRef.current);
        driftCheckTimerRef.current = null;
      }
    };
  }, []);

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
        const nextIsFinal = prev.isFinal || hasTerminalState;

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
    if (driftCheckTimerRef.current) {
      clearInterval(driftCheckTimerRef.current);
      driftCheckTimerRef.current = null;
    }
  }, []);

  const showNextFrame = useCallback(() => {
    if (!isMountedRef.current) return;

    setFrameState(prev => {
      if (prev.playQueue.length === 0 || prev.isLivePaused || prev.playbackPointer !== null) {
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
    if (
      currentState.playQueue.length === 0 ||
      currentState.isLivePaused ||
      currentState.playbackPointer !== null
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

    // Start drift checking
    if (driftCheckTimerRef.current) {
      clearInterval(driftCheckTimerRef.current);
    }
    
    driftCheckTimerRef.current = setInterval(() => {
      if (!isMountedRef.current || stateRef.current.isLivePaused || stateRef.current.playbackPointer !== null) {
        return;
      }

      const currentState = stateRef.current;
      if (currentState.orderedTimestamps.length === 0 || currentState.displayIndex < 0) return;

      const displayedTs = currentState.orderedTimestamps[currentState.displayIndex];
      const latestTs = currentState.orderedTimestamps[currentState.orderedTimestamps.length - 1];
      const currentLag = latestTs - displayedTs;

      // Adjust speed factor if we're drifting too far from target lag
      if (currentLag > currentState.desiredLagMs + 5000) {
        // We're too far behind, increase speed
        setFrameState(prev => ({
          ...prev,
          speedFactor: Math.min(MAX_SPEED_FACTOR, prev.speedFactor * 1.1)
        }));
      } else if (currentLag < currentState.desiredLagMs - 2000) {
        // We're too far ahead, pause briefly
        setFrameState(prev => ({
          ...prev,
          speedFactor: Math.max(0.5, prev.speedFactor * 0.9)
        }));
      } else if (Math.abs(currentLag - currentState.desiredLagMs) < 1000) {
        // We're close to target, reset to normal speed
        setFrameState(prev => ({
          ...prev,
          speedFactor: 1.0
        }));
      }
    }, DRIFT_CHECK_INTERVAL_MS);

    scheduleNextFrame();
  }, [scheduleNextFrame]);

  // Live playback control functions
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
    async (startingTime: string) => {
      if (!gameId) {
        return { windowFrames: [] as FrameWindow[], detailFrames: [] as FrameDetails[], metadata: undefined as GameMetadata | undefined };
      }

      const [windowResponse, detailsResponse] = await Promise.all([
        getLiveWindowGame(gameId, startingTime),
        getLiveDetailsGame(gameId, startingTime),
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

        if (backfillCursorRef.current === null) {
          const anchorTs = currentState.orderedTimestamps[0];
          if (anchorTs === undefined) {
            break;
          }
          const roundedAnchor = roundToPrevious10s(new Date(anchorTs)).getTime();
          backfillCursorRef.current = roundedAnchor;
        }

        const targetCursor = backfillCursorRef.current - BACKFILL_STEP_MS;
        backfillCursorRef.current = targetCursor;

        if (!Number.isFinite(targetCursor)) {
          markHasFirstFrame();
          break;
        }

        const targetTime = toISO(new Date(targetCursor));

        let chunk;
        try {
          chunk = await fetchChunk(targetTime);
        } catch {
          if (!isMountedRef.current || cancelBackfillRef.current) {
            break;
          }
          await delay(BACKFILL_RETRY_DELAY_MS);
          continue;
        }

        const { windowFrames, detailFrames, metadata } = chunk;

        if (windowFrames.length === 0 && detailFrames.length === 0) {
          markHasFirstFrame();
          break;
        }

        const mergeResult = mergeFrames(windowFrames, detailFrames, metadata);

        if (!mergeResult.changed) {
          await delay(BACKFILL_DELAY_MS);
          continue;
        }
        
        // Ensure scheduler continues running during backfill if we're in live mode
        if (stateRef.current.orderedTimestamps.length > 0 &&
            stateRef.current.playbackPointer === null &&
            !stateRef.current.isLivePaused &&
            schedulerTimerRef.current === null) {
          startScheduler();
        }

        if (mergeResult.addedEarlier) {
          const updatedState = stateRef.current;
          const updatedAnchor = updatedState.orderedTimestamps[0];
          if (updatedAnchor !== undefined) {
            backfillCursorRef.current = roundToPrevious10s(
              new Date(updatedAnchor)
            ).getTime();
          }
        }

        await delay(BACKFILL_DELAY_MS);
      }
    } finally {
      backfillRunningRef.current = false;
      backfillStartedRef.current = stateRef.current.hasFirstFrame;
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
  }, [fetchChunk, gameId, markHasFirstFrame, mergeFrames, setFrameState]);

  const maybeStartBackfill = useCallback(() => {
    if (
      backfillStartedRef.current ||
      backfillRunningRef.current ||
      cancelBackfillRef.current ||
      !isMountedRef.current ||
      !isBackfillEnabled
    ) {
      return;
    }

    const current = stateRef.current;
    if (current.hasFirstFrame || current.orderedTimestamps.length === 0) {
      return;
    }

    backfillStartedRef.current = true;
    void runBackfill();
  }, [runBackfill, isBackfillEnabled]);

  const startLivePolling = useCallback(() => {
    if (!gameId) {
      return;
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (DEBUG_POLLING) {
      console.log('Starting live polling for game:', gameId);
    }

    const poll = async () => {
      if (!isMountedRef.current || cancelBackfillRef.current) {
        if (DEBUG_POLLING) {
          console.log('Stopping polling - component unmounted or cancelled');
        }
        return;
      }

      // Stop polling if the game is in a terminal state
      if (stateRef.current.isFinal) {
        if (DEBUG_POLLING) {
          console.log('Stopping polling - game in terminal state');
        }
        
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
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
        
        return;
      }

      try {
        const { windowFrames, detailFrames, metadata } = await fetchChunk(
          getISODateMultiplyOf10()
        );
        const mergeResult = mergeFrames(windowFrames, detailFrames, metadata);
        if (mergeResult.hasFramesAfter) {
          maybeStartBackfill();
        }
        
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
          pollIntervalRef.current = null;
        }
      } catch {
        if (DEBUG_POLLING) {
          console.log('Error in polling, will retry');
        }
        // swallow errors; next poll will retry
      }
    };

    void poll();
    pollIntervalRef.current = setInterval(poll, LIVE_POLL_INTERVAL_MS);
  }, [fetchChunk, gameId, maybeStartBackfill, mergeFrames, setFrameState]);

  useEffect(() => {
    // Clean up any existing polling and backoff timers
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
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
        const { windowFrames, detailFrames, metadata } = await fetchChunk(
          getISODateMultiplyOf10()
        );
        const mergeResult = mergeFrames(windowFrames, detailFrames, metadata);
        if (mergeResult.hasFramesAfter && isBackfillEnabled) {
          maybeStartBackfill();
        }
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
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (finalStateBackoffRef.current) {
        clearTimeout(finalStateBackoffRef.current);
        finalStateBackoffRef.current = null;
      }
    };
  }, [fetchChunk, gameId, maybeStartBackfill, mergeFrames, setFrameState, startLivePolling]);

  const goLive = useCallback(() => {
    setFrameState((prev) => {
      if (prev.playbackPointer === null) {
        return prev;
      }
      // Reset display index to latest and resume live playback
      return {
        ...prev,
        playbackPointer: null,
        displayIndex: prev.livePointer,
        isLivePaused: false
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
          displayIndex: index
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
