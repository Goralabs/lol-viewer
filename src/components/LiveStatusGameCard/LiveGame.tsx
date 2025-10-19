import './styles/playerStatusStyle.css'
import './styles/liveGameEnhancements.css'

import {
    getGameDetails,
} from "../../utils/LoLEsportsAPI";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactComponent as Loading } from "../../assets/images/loading.svg";
import { PlayersTable } from "./PlayersTable";
import { GameDetails } from "./types/detailsPersistentTypes";
import { useParams } from "react-router-dom";
import { useFrameIndex } from "./useFrameIndex";
import { TimelineScrubber } from "./TimelineScrubber";
import { SeriesScoreboard } from "./SeriesScoreboard";
import { useSeriesSummary } from "../../hooks/useSeriesSummary";
import { GoldGraph } from "./GoldGraph";
import { ObjectiveTimeline } from "./ObjectiveTimeline";
import { useResponsive } from "../../hooks/useResponsive";
import { useBackfill } from "../Navbar/BackfillContext";
import { MetaTags } from "../Meta/MetaTags";

export function LiveGame() {
    const [gameData, setGameData] = useState<GameDetails>();
    const [selectedGameNumber, setSelectedGameNumber] = useState<number>();
    const [selectedGameId, setSelectedGameId] = useState<string>();

    const { gameid } = useParams<{ gameid: string }>();
    const matchId = gameid || "";
    const { isMobile } = useResponsive();
    const { isBackfillEnabled } = useBackfill();
    
    // Use the series summary hook to get enhanced series data
    const { seriesSummary, getGameSummary, windowDataMap } = useSeriesSummary({
        eventId: matchId,
        gameDetails: gameData,
        enabled: !!gameData
    });
    
    // Get the current game summary for additional context
    // TODO: Use this to display additional game information (duration, VODs, etc.)
    const currentGameSummary = useMemo(() => {
        if (!seriesSummary || selectedGameNumber === undefined) return null;
        return getGameSummary(selectedGameNumber);
    }, [seriesSummary, selectedGameNumber, getGameSummary]);
    
    // Create a map of game durations from the series summary
    const gameDurations = useMemo(() => {
        const durations = new Map<string, number | null>();
        if (seriesSummary) {
            seriesSummary.games.forEach(game => {
                durations.set(game.id, game.durationSeconds || null);
            });
        }
        return durations;
    }, [seriesSummary]);

    const gameWinnerOverrides = useMemo(() => {
        if (!seriesSummary) return undefined;
        const winners = new Map<string, string | null>();
        seriesSummary.games.forEach(game => {
            winners.set(game.id, game.winnerTeamId ?? null);
        });
        return winners;
    }, [seriesSummary]);
    
    // Use our new frame index hook for frame management
    const {
        currentWindow,
        currentDetails,
        currentMetadata,
        windowFrames: orderedWindowFrames,
        timestamps,
        hasFirstFrame,
        isBackfilling,
        isLive,
        isFinal,
        selectedTimestamp,
        goLive,
        setPlaybackByEpoch,
        
        // Live playback controls
        isLivePaused,
        desiredLagMs,
        speedFactor,
        displayedTs,
        pauseLive,
        resumeLive,
        setDesiredLagMs,
        setSpeedFactor,
    } = useFrameIndex(selectedGameId || "");

    const selectedGameState = useMemo(() => {
        if (!gameData || selectedGameNumber === undefined) return undefined;
        const selected = gameData.data.event.match.games.find(
            (g) => g.number === selectedGameNumber
        );
        return selected?.state;
    }, [gameData, selectedGameNumber]);

    const isUpcomingGame = useMemo(() => {
        if (!selectedGameState) return false;
        const value = selectedGameState.toLowerCase();
        return ["unstarted", "not_started", "notstarted", "scheduled", "pending"].includes(
            value
        );
    }, [selectedGameState]);

    const resetFrames = useCallback(() => {
        // Frame management is now handled by useFrameIndex hook
    }, []);

    useEffect(() => {
        if (!matchId) {
            setGameData(undefined);
            setSelectedGameNumber(undefined);
            setSelectedGameId(undefined);
            resetFrames();
            return;
        }

        let isMounted = true;

        resetFrames();
        setGameData(undefined);
        setSelectedGameNumber(undefined);
        setSelectedGameId(undefined);

        getGameDetails(matchId)
            .then((response) => {
                if (!isMounted) return;

                const details: GameDetails | undefined = response.data;
                if (!details) return;

                setGameData(details);
                const games = details.data.event.match.games ?? [];
                if (!games.length) return;

                const inProgress =
                    games.find((g) => g.state === "inProgress") ??
                    games.find((g) => g.state === "in_game");
                const latestCompleted = [...games]
                    .reverse()
                    .find((g) => {
                        const state = (g.state ?? "").toLowerCase();
                        return ["completed", "finished", "postgame", "post_game"].includes(
                            state
                        );
                    });
                const fallback = games[0];
                const defaultGame = inProgress ?? latestCompleted ?? fallback;

                if (defaultGame) {
                    setSelectedGameNumber(defaultGame.number);
                    setSelectedGameId(defaultGame.id);
                }
            })
            .catch(() => {});

        return () => {
            isMounted = false;
        };
    }, [matchId, resetFrames]);

    // Frame fetching is now handled by the useFrameIndex hook

    // Get frames for new components
    const windowFrames = orderedWindowFrames;


    const hasFullTimeline = hasFirstFrame && timestamps.length > 1;

    const handleGameSelection = useCallback(
        (gameNumber: number) => {
            if (!gameData) return;
            if (gameNumber === selectedGameNumber) return;

            const targeted = gameData.data.event.match.games.find(
                (g) => g.number === gameNumber
            );
            if (!targeted) return;

            setSelectedGameNumber(targeted.number);
            setSelectedGameId(targeted.id);
        },
        [gameData, selectedGameNumber]
    );

    // Replace the old game selector with the new SeriesScoreboard
    const seriesScoreboard = useMemo(() => {
        if (!gameData || selectedGameNumber === undefined) return null;
        return (
            <SeriesScoreboard
                gameDetails={gameData}
                selectedGameNumber={selectedGameNumber}
                onGameSelect={handleGameSelection}
                gameDurations={gameDurations}
                gameWinnersOverride={gameWinnerOverrides}
                windowDataMap={windowDataMap}
            />
        );
    }, [gameData, selectedGameNumber, handleGameSelection, gameDurations, gameWinnerOverrides, windowDataMap]);
    

    // Use metadata from the hook
    const metadata = currentMetadata;

    // Generate dynamic metadata for the game
    const gameMetaTitle = useMemo(() => {
        if (!gameData || !gameData.data.event.match.teams || selectedGameNumber === undefined) {
            return "Live LoL Esports - Real-time League of Legends Esports Viewer";
        }
        
        const teams = gameData.data.event.match.teams;
        const team1Name = teams[0]?.name || "Team 1";
        const team2Name = teams[1]?.name || "Team 2";
        const gameNumber = selectedGameNumber;
        
        return `${team1Name} vs ${team2Name} - Game ${gameNumber} | Live LoL Esports`;
    }, [gameData, selectedGameNumber]);

    const gameMetaDescription = useMemo(() => {
        if (!gameData || !gameData.data.event.match.teams || selectedGameNumber === undefined) {
            return "Follow League of Legends esports in real-time. View live match data, schedules, gold graphs, objective timelines, and post-game insights.";
        }
        
        const teams = gameData.data.event.match.teams;
        const team1Name = teams[0]?.name || "Team 1";
        const team2Name = teams[1]?.name || "Team 2";
        const gameNumber = selectedGameNumber;
        const leagueName = gameData.data.event.league?.name || "League of Legends Esports";
        
        return `Watch ${team1Name} vs ${team2Name} in Game ${gameNumber} of the ${leagueName}. Real-time stats, gold graphs, and objective timelines.`;
    }, [gameData, selectedGameNumber]);

    const gameMetaUrl = useMemo(() => {
        return `https://live-lol-esports.goralabs.dev/#/live/${matchId}`;
    }, [matchId]);

    return (
        <div>
            <MetaTags
                title={gameMetaTitle}
                description={gameMetaDescription}
                url={gameMetaUrl}
                type="website"
            />
            
            {/* Series Scoreboard */}
            {seriesScoreboard}

            {/* Timeline Scrubber - Only show when backfill is enabled */}
            {selectedGameId && isBackfillEnabled && (
                <TimelineScrubber
                    timestamps={timestamps}
                    value={selectedTimestamp}
                    onChange={setPlaybackByEpoch}
                    onLive={goLive}
                    disabled={!hasFirstFrame}
                    isBackfilling={isBackfilling}
                    
                    // Live playback props
                    isLivePaused={isLivePaused}
                    desiredLagMs={desiredLagMs}
                    speedFactor={speedFactor}
                    displayedTs={displayedTs}
                    pauseLive={pauseLive}
                    resumeLive={resumeLive}
                    setDesiredLagMs={setDesiredLagMs}
                    setSpeedFactor={setSpeedFactor}
                />
            )}

            {/* Content - Players Table */}
            {currentWindow !== undefined &&
            currentDetails !== undefined &&
            metadata !== undefined &&
            gameData !== undefined ? (
                <PlayersTable
                    lastFrameWindow={currentWindow}
                    lastFrameDetails={currentDetails}
                    gameMetadata={metadata}
                    gameDetails={gameData}
                    isLive={isLive}
                    isFinal={isFinal}
                />
            ) : isUpcomingGame ? (
                <div className="loading-game-container">
                    <span>Selected game has not started yet.</span>
                </div>
            ) : (
                <div className="loading-game-container">
                    <Loading className="loading-game-image" />
                </div>
            )}

            {/* Live Game Enhancements - New Components */}
            {currentWindow && currentDetails && metadata && hasFullTimeline && (
                <>
                    {!isMobile && (
                        <div className="live-game-enhancements">
                            <div className="enhancements-row">
                                <div className="enhancement-section">
                                    <GoldGraph
                                        frames={windowFrames}
                                        selectedTimestamp={selectedTimestamp}
                                        onTimestampClick={setPlaybackByEpoch}
                                    />
                                </div>
                            </div>
                            
                            <div className="enhancements-row">
                                <div className="enhancement-section">
                                    <ObjectiveTimeline
                                        frames={windowFrames}
                                        selectedTimestamp={selectedTimestamp}
                                        onTimestampClick={setPlaybackByEpoch}
                                    />
                                </div>
                            </div>
                            
                        </div>
                    )}
                    
                    {/* Mobile-optimized components */}
                    {isMobile && (
                        <div className="mobile-enhancements">
                            <div className="mobile-enhancement-section">
                                    <GoldGraph
                                        frames={windowFrames}
                                        selectedTimestamp={selectedTimestamp}
                                        onTimestampClick={setPlaybackByEpoch}
                                        height={150}
                                    />
                            </div>
                            
                            <div className="mobile-enhancement-section">
                                    <ObjectiveTimeline
                                        frames={windowFrames}
                                        selectedTimestamp={selectedTimestamp}
                                        onTimestampClick={setPlaybackByEpoch}
                                    />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
