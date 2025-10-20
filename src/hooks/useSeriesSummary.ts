import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { GameDetails } from "../components/LiveStatusGameCard/types/detailsPersistentTypes";
import { WindowLive } from "../components/LiveStatusGameCard/types/windowLiveTypes";
import { buildSeriesSummary } from "../utils/seriesUtils";
import { getLiveWindowGame, getISODateMultiplyOf10 } from "../utils/LoLEsportsAPI";

interface UseSeriesSummaryProps {
    eventId: string;
    gameDetails: GameDetails | undefined;
    enabled?: boolean;
}

export function useSeriesSummary({
    eventId,
    gameDetails,
    enabled = true
}: UseSeriesSummaryProps) {
    const COMPLETED_STATES = useMemo(() => new Set(["completed", "finished", "postgame", "post_game"]), []);
    const LIVE_STATES = useMemo(() => new Set(["inprogress", "in_progress", "in_game"]), []);
    const FINAL_FRAME_STATES = useMemo(() => new Set(["finished", "postgame", "post_game", "ended", "completed"]), []);

    const [windowDataMap, setWindowDataMap] = useState<Map<string, WindowLive>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const requestedRef = useRef<Set<string>>(new Set());

    // Reset cached window data when the event changes so we always refetch fresh frames
    useEffect(() => {
        if (!eventId) {
            setWindowDataMap(new Map());
            setError(null);
            requestedRef.current.clear();
            return;
        }
        setWindowDataMap(new Map());
        setError(null);
        requestedRef.current.clear();
    }, [eventId]);

    // Fetch window data for completed games to enhance the summary
    const fetchWindowData = useCallback(async (gameId: string) => {
        try {
            const timestamp = getISODateMultiplyOf10();
            const response = await getLiveWindowGame(gameId, timestamp);
            const data = response.data;

            if (data && data.frames && data.frames.length > 0) {
                const lastFrame = data.frames[data.frames.length - 1];
                const trimmed: WindowLive = {
                    ...data,
                    frames: lastFrame ? [lastFrame] : []
                };
                setWindowDataMap(prev => {
                    const next = new Map(prev);
                    next.set(gameId, trimmed);
                    return next;
                });
            }
        } catch (err) {
            // Silently fail for window data - it's enhancement only
        }
    }, []);

    const hasFinalFrame = useCallback((data: WindowLive | undefined) => {
        if (!data?.frames?.length) {
            return false;
        }
        const lastFrame = data.frames[data.frames.length - 1];
        const state = (lastFrame.gameState || "").toLowerCase();
        return FINAL_FRAME_STATES.has(state);
    }, [FINAL_FRAME_STATES]);

    // Fetch window data for completed games when game details change
    useEffect(() => {
        if (!gameDetails || !enabled) return;

        const relevantGames = gameDetails.data.event.match.games.filter(game => {
            const state = (game.state || "").toLowerCase();
            return COMPLETED_STATES.has(state) || LIVE_STATES.has(state);
        });

        // Determine which games still need a final data fetch
        const gamesToFetch = relevantGames.filter(game => {
            const id = game.id;
            if (requestedRef.current.has(id)) return false;
            const existing = windowDataMap.get(id);
            // Only fetch once per game if we have nothing yet
            return !existing;
        });

        if (gamesToFetch.length === 0) return;

        setIsLoading(true);
        setError(null);

        // Mark requested to avoid immediate refetch loops
        gamesToFetch.forEach(g => requestedRef.current.add(g.id));

        // Fetch window data for each relevant game once
        Promise.allSettled(gamesToFetch.map(game => fetchWindowData(game.id))).then(() => {
            setIsLoading(false);
        }).catch(err => {
            setError(err instanceof Error ? err.message : "Failed to fetch game data");
            setIsLoading(false);
        });
    }, [gameDetails, enabled, fetchWindowData, windowDataMap, COMPLETED_STATES, LIVE_STATES, hasFinalFrame]);

    // Build the series summary using the memoized hook
    const seriesSummary = useMemo(() => {
        if (!gameDetails || !enabled) return null;
        
        try {
            return buildSeriesSummary(eventId, gameDetails, windowDataMap);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to build series summary");
            return null;
        }
    }, [eventId, gameDetails, windowDataMap, enabled]);

    // Get a specific game summary
    const getGameSummary = useCallback((gameNumber: number) => {
        if (!seriesSummary) return null;
        return seriesSummary.games.find(game => game.number === gameNumber) || null;
    }, [seriesSummary]);

    // Refresh window data for a specific game
    const refreshGameData = useCallback(async (gameId: string) => {
        await fetchWindowData(gameId);
    }, [fetchWindowData]);

    return {
        seriesSummary,
        isLoading,
        error,
        getGameSummary,
        refreshGameData,
        windowDataMap
    };
}
