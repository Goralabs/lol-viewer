import React, { useMemo } from "react";
import { GameDetails } from "./types/detailsPersistentTypes";
import { determineSeriesWinners, getSeriesStatus } from "../../utils/seriesUtils";
import { WindowLive } from "./types/windowLiveTypes";
import "./styles/seriesScoreboard.css";

interface SeriesScoreboardProps {
    gameDetails: GameDetails;
    selectedGameNumber: number;
    onGameSelect: (gameNumber: number) => void;
    gameDurations?: Map<string, number | null>;
    gameWinnersOverride?: Map<string, string | null>;
    windowDataMap?: Map<string, WindowLive>;
}

export function SeriesScoreboard({
    gameDetails,
    selectedGameNumber,
    onGameSelect,
    gameDurations: _gameDurations,
    gameWinnersOverride,
    windowDataMap
}: SeriesScoreboardProps) {
    const { match } = gameDetails.data.event;
    const { teams, games } = match;
    void _gameDurations;
    
    // Determine series information using our utility functions
    const seriesInfo = useMemo(() => {
        return getSeriesStatus(gameDetails);
    }, [gameDetails]);
    
    // Determine winners for each game; compute every render so in-place windowDataMap mutations propagate immediately.
    const computedWinners = determineSeriesWinners(gameDetails, windowDataMap);
    const gameWinners = gameWinnersOverride
        ? (() => {
            const merged = new Map(computedWinners);
            gameWinnersOverride.forEach((value, key) => {
                if (value !== undefined && value !== null) {
                    merged.set(key, value);
                }
            });
            return merged;
        })()
        : computedWinners;

    // Create game pills for display
    const gamePills = useMemo(() => {
        return games
            .filter(game => {
                const state = (game.state || "").toLowerCase();
                // If series is complete, only show games that were played (completed or in progress)
                if (seriesInfo.isSeriesComplete) {
                    return ["completed", "finished", "postgame", "post_game", "inprogress", "in_game"].includes(state);
                }
                // Otherwise, show games that have started or completed
                return !["unstarted", "not_started", "notstarted", "scheduled", "pending"].includes(state);
            })
            .sort((a, b) => a.number - b.number)
            .map(game => {
                const normalizedState = (game.state || "").toLowerCase();
                const isActive = game.number === selectedGameNumber;
                const isLive = ["inprogress", "in_progress", "in_game"].includes(normalizedState);
                const isCompleted = ["completed", "finished", "postgame", "post_game"].includes(normalizedState);
                
                // Use deterministic winner detection
                const winnerTeamId = gameWinners.get(game.id);
                let winningTeamIndex = null;
                
                if (winnerTeamId) {
                    // Map winner to series position (left/right), not in-game side (blue/red)
                    // This ensures consistent coloring regardless of side swaps
                    const teamIndex = teams.findIndex(t => t.id === winnerTeamId);
                    if (teamIndex !== -1) {
                        winningTeamIndex = teamIndex;
                    } else {
                        const gameTeam = game.teams?.find(team => team.id === winnerTeamId);
                        const side = gameTeam?.side?.toLowerCase();
                        const windowData = windowDataMap?.get(game.id);

                        if (side && windowData?.gameMetadata) {
                            const metadataTeamId = side === "blue"
                                ? windowData.gameMetadata.blueTeamMetadata?.esportsTeamId
                                : windowData.gameMetadata.redTeamMetadata?.esportsTeamId;

                            if (metadataTeamId) {
                                const metadataIndex = teams.findIndex(t => t.id === metadataTeamId);
                                if (metadataIndex !== -1) {
                                    winningTeamIndex = metadataIndex;
                                } else {
                                }
                            } else {
                            }
                        } else {
                        }
                    }
                }
                
                return {
                    gameNumber: game.number,
                    gameId: game.id,
                    isActive,
                    isLive,
                    isCompleted,
                    winningTeamIndex: winningTeamIndex >= 0 ? winningTeamIndex : null,
                    vods: game.vods || []
                };
            });
    }, [games, selectedGameNumber, gameWinners, teams, seriesInfo, windowDataMap]);
    
    return React.createElement('div', {
        className: "series-scoreboard",
        "aria-live": "polite",
        "aria-label": `Series score: ${teams[0]?.name} ${seriesInfo.teamWins[teams[0]?.id] || 0} - ${seriesInfo.teamWins[teams[1]?.id] || 0} ${teams[1]?.name}, Best of ${seriesInfo.bestOfCount}${seriesInfo.isSeriesComplete ? ', Series Complete' : ''}`
    },
        // Team color banners
        React.createElement('div', { className: "team-banners" },
            React.createElement('div', { className: "team-banner blue-banner" }),
            React.createElement('div', { className: "team-banner red-banner" })
        ),
        // Team headers with logos and scores
        React.createElement('div', { className: "series-header" },
            // Blue team
            React.createElement('div', { className: "team-info blue-team" },
                React.createElement('img', {
                    src: teams[0]?.image,
                    alt: teams[0]?.name,
                    className: "team-logo"
                }),
                React.createElement('div', { className: "team-details" },
                    React.createElement('h3', { className: "team-name" }, teams[0]?.name),
                    React.createElement('div', { className: "team-code" }, teams[0]?.code)
                )
            ),
            
            // Series score
            React.createElement('div', { className: "series-score" },
                React.createElement('div', { className: "score-display" },
                    React.createElement('span', {
                        className: `team-score ${seriesInfo.seriesWinner?.id === teams[0]?.id ? 'winner' : ''}`
                    }, seriesInfo.teamWins[teams[0]?.id] || 0),
                    React.createElement('span', { className: "score-separator" }, "–"),
                    React.createElement('span', {
                        className: `team-score ${seriesInfo.seriesWinner?.id === teams[1]?.id ? 'winner' : ''}`
                    }, seriesInfo.teamWins[teams[1]?.id] || 0)
                ),
                React.createElement('div', { className: "series-format" }, `Best of ${seriesInfo.bestOfCount}`),
                // Match point badge or series complete status
                seriesInfo.isSeriesComplete
                    ? React.createElement('div', { className: "series-status complete" }, "Series Complete")
                    : seriesInfo.shouldShowMatchPoint
                        ? React.createElement('div', {
                            className: "series-status match-point",
                            "aria-label": `${seriesInfo.teamsAtMatchPoint.length === 2 ? 'Both teams' : seriesInfo.teamsAtMatchPoint[0]?.name} at match point`
                        }, "Match Point")
                        : null
            ),
            
            // Red team
            React.createElement('div', { className: "team-info red-team" },
                React.createElement('img', {
                    src: teams[1]?.image,
                    alt: teams[1]?.name,
                    className: "team-logo"
                }),
                React.createElement('div', { className: "team-details" },
                    React.createElement('h3', { className: "team-name" }, teams[1]?.name),
                    React.createElement('div', { className: "team-code" }, teams[1]?.code)
                )
            )
        ),
        
        // Game pills
        React.createElement('div', { className: "game-pills-container" },
            gamePills.map(pill => {
                // Create a descriptive label for accessibility
                const winnerText = pill.winningTeamIndex !== null
                    ? ` - Winner: ${teams[pill.winningTeamIndex]?.name}`
                    : '';
                const statusText = pill.isLive ? ' - LIVE' : pill.isCompleted ? ' - Completed' : '';
                
                const winnerClass =
                    pill.winningTeamIndex === 0 ? "team-left-win" :
                    pill.winningTeamIndex === 1 ? "team-right-win" :
                    "no-winner";

                return React.createElement('button', {
                    key: pill.gameId,
                    className: `game-pill ${pill.isActive ? 'active' : ''} ${winnerClass} ${pill.isLive ? 'live' : ''}`,
                    onClick: () => onGameSelect(pill.gameNumber),
                    title: `Game ${pill.gameNumber}${statusText}${winnerText}`,
                    "aria-label": `Game ${pill.gameNumber}${statusText}${winnerText}`,
                    "aria-current": pill.isActive ? "true" : "false"
                },
                    `Game ${pill.gameNumber}`
                );
            })
        )
    );
}
