import { GameDetails, Game, Team } from "../components/LiveStatusGameCard/types/detailsPersistentTypes";
import { WindowLive } from "../components/LiveStatusGameCard/types/windowLiveTypes";

const COMPLETED_STATES = new Set(["completed", "finished", "postgame", "post_game"]);
const UPCOMING_STATES = new Set(["unstarted", "not_started", "notstarted", "scheduled", "pending"]);
const LIVE_STATES = new Set(["inprogress", "in_progress", "in_game"]);

function normalizeState(state: string | undefined) {
    return (state || "").toLowerCase();
}

function isCompletedState(state: string | undefined) {
    return COMPLETED_STATES.has(normalizeState(state));
}

function isUpcomingState(state: string | undefined) {
    return UPCOMING_STATES.has(normalizeState(state));
}

function isLiveState(state: string | undefined) {
    return LIVE_STATES.has(normalizeState(state));
}

function getTeamResultFromGame(game: Game | undefined, teamId: string) {
    if (!game) return undefined;
    return game.teams.find(team => team.id === teamId)?.result;
}

function getTeamWinsFromGame(game: Game | undefined, teamId: string) {
    const result = getTeamResultFromGame(game, teamId);
    return typeof result?.gameWins === "number" ? result.gameWins : undefined;
}

function getTeamOutcomeFromGame(game: Game | undefined, teamId: string) {
    const result = getTeamResultFromGame(game, teamId);
    return result?.outcome ? result.outcome.toLowerCase() : undefined;
}

function resolveSeriesTeamId(
    rawTeamId: string | null | undefined,
    game: Game,
    seriesTeams: Team[],
    windowData?: WindowLive
): string | null {
    if (!rawTeamId) {
        return null;
    }

    if (seriesTeams.some(team => team.id === rawTeamId)) {
        return rawTeamId;
    }

    const gameTeam = game.teams.find(team => team.id === rawTeamId);
    const side = gameTeam?.side?.toLowerCase();

    if (side && windowData?.gameMetadata) {
        const metadataTeamId =
            side === "blue"
                ? windowData.gameMetadata.blueTeamMetadata?.esportsTeamId
                : windowData.gameMetadata.redTeamMetadata?.esportsTeamId;

        if (metadataTeamId && seriesTeams.some(team => team.id === metadataTeamId)) {
            return metadataTeamId;
        }
    }

    return null;
}

function determineWinnerFromWindow(
    game: Game,
    windowData?: WindowLive
): string | null {
    if (!windowData?.frames?.length) {
        return null;
    }

    const blueTeamId = game.teams.find(team => team.side?.toLowerCase() === "blue")?.id;
    const redTeamId = game.teams.find(team => team.side?.toLowerCase() === "red")?.id;

    if (!blueTeamId || !redTeamId) {
        return null;
    }

    const lastFrame = windowData.frames[windowData.frames.length - 1];
    const blueFrame = lastFrame.blueTeam;
    const redFrame = lastFrame.redTeam;

    if (!blueFrame || !redFrame) {
        return null;
    }

    const blueGold = blueFrame.totalGold ?? 0;
    const redGold = redFrame.totalGold ?? 0;

    // Gold difference is a strong indicator
    if (blueGold > redGold && Math.abs(blueGold - redGold) > 1000) {
        return blueTeamId;
    }
    if (redGold > blueGold && Math.abs(redGold - blueGold) > 1000) {
        return redTeamId;
    }

    // Enhanced objective scoring with more nuanced weights
    const tallyObjectives = (teamFrame: typeof blueFrame) => {
        const countDragons = Array.isArray(teamFrame.dragons) ? teamFrame.dragons.length : 0;
        const countElderDragons = Array.isArray(teamFrame.dragons)
            ? teamFrame.dragons.filter(d => d === "elder").length
            : 0;
        const countInhibitors = teamFrame.inhibitors ?? 0;
        const countBarons = teamFrame.barons ?? 0;
        const countTowers = teamFrame.towers ?? 0;
        
        // Enhanced scoring: Elder dragons are worth more, inhibitors are very valuable
        return (
            countBarons * 300 +           // Barons are most valuable
            countElderDragons * 200 +     // Elder dragons are very valuable
            countInhibitors * 100 +       // Inhibitors are crucial
            countTowers * 10 +            // Towers are moderately valuable
            countDragons * 5              // Regular dragons are least valuable
        );
    };

    const blueObjectives = tallyObjectives(blueFrame);
    const redObjectives = tallyObjectives(redFrame);

    if (blueObjectives > redObjectives) {
        return blueTeamId;
    }
    if (redObjectives > blueObjectives) {
        return redTeamId;
    }

    // Check for Nexus/ancient structure destruction (most definitive win condition)
    const blueNexusDestroyed = (blueFrame.towers ?? 11) === 0 && (blueFrame.inhibitors ?? 3) === 0;
    const redNexusDestroyed = (redFrame.towers ?? 11) === 0 && (redFrame.inhibitors ?? 3) === 0;
    
    if (blueNexusDestroyed && !redNexusDestroyed) {
        return redTeamId;
    }
    if (redNexusDestroyed && !blueNexusDestroyed) {
        return blueTeamId;
    }

    // Final fallback: small gold difference (less than 1000)
    if (blueGold > redGold) {
        return blueTeamId;
    }
    if (redGold > blueGold) {
        return redTeamId;
    }

    return null;
}

/**
 * Determines the winner of a specific game in a series using deterministic logic
 * @param game The game to determine the winner for
 * @param teams All teams in the series
 * @param previousGames Previous games in the series (in order)
 * @param windowData Optional live window data for fallback winner detection
 * @param assignedWins Running tally of confirmed wins per team
 * @returns The team ID that won the game, or null if undeterminable
 */
export function determineGameWinner(
    game: Game,
    teams: Team[],
    previousGames: Game[] = [],
    windowData?: WindowLive,
    assignedWins: Record<string, number> = {}
): string | null {
    // For completed games, try to determine the winner by checking win progression
    const isCompleted = isCompletedState(game.state);

    if (!isCompleted) {
        return null; // Game is not completed
    }

    // Get the teams playing in this game
    const blueTeamInGame = game.teams.find(team => team.side?.toLowerCase() === "blue");
    const redTeamInGame = game.teams.find(team => team.side?.toLowerCase() === "red");

    if (!blueTeamInGame || !redTeamInGame) {
        return null; // Can't determine teams
    }

    // Resolve the series-level team IDs so we can reference match totals even when per-game IDs differ
    const resolvedBlueSeriesId = resolveSeriesTeamId(blueTeamInGame.id, game, teams, windowData) ?? blueTeamInGame.id;
    const resolvedRedSeriesId = resolveSeriesTeamId(redTeamInGame.id, game, teams, windowData) ?? redTeamInGame.id;

    // Get the current win counts for both teams
    const blueTeamResult = teams.find(t => t.id === resolvedBlueSeriesId);
    const redTeamResult = teams.find(t => t.id === resolvedRedSeriesId);

    if (!blueTeamResult || !redTeamResult) {
        return null; // Can't find team results
    }

    // Determine wins before this game using assigned wins or previous game data
    const previousBlueWins =
        assignedWins[resolvedBlueSeriesId] ??
        (() => {
            const reversed = [...previousGames].reverse();
            for (const prevGame of reversed) {
                if (!isCompletedState(prevGame.state)) continue;
                const wins = getTeamWinsFromGame(prevGame, blueTeamInGame.id);
                if (typeof wins === "number") return wins;
            }
            return 0;
        })();

    const previousRedWins =
        assignedWins[resolvedRedSeriesId] ??
        (() => {
            const reversed = [...previousGames].reverse();
            for (const prevGame of reversed) {
                if (!isCompletedState(prevGame.state)) continue;
                const wins = getTeamWinsFromGame(prevGame, redTeamInGame.id);
                if (typeof wins === "number") return wins;
            }
            return 0;
        })();


    // Prefer explicit per-game outcome
    const blueOutcome = getTeamOutcomeFromGame(game, blueTeamInGame.id);
    if (blueOutcome === "win") {
        return blueTeamInGame.id;
    }
    const redOutcome = getTeamOutcomeFromGame(game, redTeamInGame.id);
    if (redOutcome === "win") {
        return redTeamInGame.id;
    }

    // If result provides cumulative wins for this game, compare against previous wins
    const blueWinsAfter = getTeamWinsFromGame(game, blueTeamInGame.id);
    const redWinsAfter = getTeamWinsFromGame(game, redTeamInGame.id);

    if (
        typeof blueWinsAfter === "number" &&
        blueWinsAfter >= previousBlueWins &&
        blueWinsAfter - previousBlueWins === 1
    ) {
        return blueTeamInGame.id;
    }
    if (
        typeof redWinsAfter === "number" &&
        redWinsAfter >= previousRedWins &&
        redWinsAfter - previousRedWins === 1
    ) {
        return redTeamInGame.id;
    }

    // As a fallback, compare the final match totals with assigned wins
    const blueTotalWins = blueTeamResult.result?.gameWins ?? 0;
    const redTotalWins = redTeamResult.result?.gameWins ?? 0;
    const assignedBlueWins = assignedWins[resolvedBlueSeriesId] ?? 0;
    const assignedRedWins = assignedWins[resolvedRedSeriesId] ?? 0;
    const remainingBlueWins = blueTotalWins - assignedBlueWins;
    const remainingRedWins = redTotalWins - assignedRedWins;

    if (remainingBlueWins <= 0 && remainingRedWins <= 0) {
        // No wins left to assign; fall back to window if possible
        return determineWinnerFromWindow(game, windowData);
    }

    if (remainingBlueWins > 0 && remainingRedWins <= 0) {
        return blueTeamInGame.id;
    }

    if (remainingRedWins > 0 && remainingBlueWins <= 0) {
        return redTeamInGame.id;
    }

    // If we can't determine from win progression, use window data as a deterministic fallback
    const fallbackWinner = determineWinnerFromWindow(game, windowData);
    if (fallbackWinner) {
        return fallbackWinner;
    }

    // As a last resort, return null
    return null;
}

/**
 * Determines the winner for all games in a series
 * @param gameDetails The series details
 * @returns A map of game IDs to winner team IDs
 */
export function determineSeriesWinners(
    gameDetails: GameDetails,
    windowDataMap?: Map<string, WindowLive>
): Map<string, string | null> {
    const { match } = gameDetails.data.event;
    const { teams, games, strategy } = match;

    const winners = new Map<string, string | null>();
    const sortedGames = [...games].sort((a, b) => a.number - b.number);
    const assignedWins: Record<string, number> = {};
    const finalWins: Record<string, number> = {};
    teams.forEach(team => {
        assignedWins[team.id] = 0;
        finalWins[team.id] = team.result?.gameWins ?? 0;
    });

    const unresolvedGames: Array<{ game: Game; windowData?: WindowLive }> = [];

    for (let i = 0; i < sortedGames.length; i++) {
        const game = sortedGames[i];
        const previousGames = sortedGames.slice(0, i);
        const windowData = windowDataMap?.get(game.id);
        
        const winner = determineGameWinner(game, teams, previousGames, windowData, assignedWins);
        const resolvedWinner = resolveSeriesTeamId(winner, game, teams, windowData);
        const winnerForDisplay = resolvedWinner ?? winner ?? null;
        winners.set(game.id, winnerForDisplay);

        const assignmentKey =
            resolvedWinner ??
            (winner && teams.some(team => team.id === winner) ? winner : null);

        if (winnerForDisplay && assignmentKey) {
            assignedWins[assignmentKey] = (assignedWins[assignmentKey] || 0) + 1;
        } else {
            unresolvedGames.push({ game, windowData });
        }
    }

    if (unresolvedGames.length > 0) {
        const winsToWin = strategy?.count ? Math.floor(strategy.count / 2) + 1 : undefined;
        const seriesWinner = winsToWin
            ? teams.find(team => finalWins[team.id] >= winsToWin)
            : undefined;

        for (const { game, windowData } of unresolvedGames) {
            const blueTeamInGame = game.teams.find(team => team.side?.toLowerCase() === "blue");
            const redTeamInGame = game.teams.find(team => team.side?.toLowerCase() === "red");

            const resolvedBlue = resolveSeriesTeamId(blueTeamInGame?.id, game, teams, windowData) ?? blueTeamInGame?.id ?? null;
            const resolvedRed = resolveSeriesTeamId(redTeamInGame?.id, game, teams, windowData) ?? redTeamInGame?.id ?? null;

            const remainingBlue = resolvedBlue ? (finalWins[resolvedBlue] ?? 0) - (assignedWins[resolvedBlue] ?? 0) : 0;
            const remainingRed = resolvedRed ? (finalWins[resolvedRed] ?? 0) - (assignedWins[resolvedRed] ?? 0) : 0;

            let fallbackWinner: string | null = null;

            if (remainingBlue > 0 && remainingRed <= 0) {
                fallbackWinner = resolvedBlue;
            } else if (remainingRed > 0 && remainingBlue <= 0) {
                fallbackWinner = resolvedRed;
            }

            if (!fallbackWinner) {
                const windowWinnerRaw = determineWinnerFromWindow(game, windowData);
                const windowWinnerResolved = resolveSeriesTeamId(windowWinnerRaw, game, teams, windowData) ?? windowWinnerRaw ?? null;
                if (windowWinnerResolved && teams.some(team => team.id === windowWinnerResolved)) {
                    fallbackWinner = windowWinnerResolved;
                }
            }

            if (!fallbackWinner && seriesWinner) {
                const remainingSeriesWinnerWins = finalWins[seriesWinner.id] - (assignedWins[seriesWinner.id] ?? 0);
                const opponentsHaveWins = teams
                    .filter(team => team.id !== seriesWinner.id)
                    .some(team => (finalWins[team.id] - (assignedWins[team.id] ?? 0)) > 0);

                if (remainingSeriesWinnerWins > 0 && !opponentsHaveWins) {
                    fallbackWinner = seriesWinner.id;
                }
            }

            if (!fallbackWinner && remainingBlue !== remainingRed) {
                fallbackWinner = remainingBlue > remainingRed ? resolvedBlue : resolvedRed;
            }

            if (!fallbackWinner) {
                fallbackWinner = resolvedBlue ?? resolvedRed ?? null;
            }

            if (fallbackWinner) {
                winners.set(game.id, fallbackWinner);
                assignedWins[fallbackWinner] = (assignedWins[fallbackWinner] || 0) + 1;
            } else {
            }
        }
    }

    return winners;
}

/**
 * Checks if a team is at match point (one win away from winning the series)
 * @param teamWins The current wins for the team
 * @param winsToWin The number of wins needed to win the series
 * @returns True if the team is at match point
 */
export function isMatchPoint(teamWins: number, winsToWin: number): boolean {
    return teamWins === winsToWin - 1;
}

/**
 * Determines if a series is complete and which team won
 * @param gameDetails The series details
 * @returns Object with series completion status and winner info
 */
export function getSeriesStatus(gameDetails: GameDetails) {
    const { match } = gameDetails.data.event;
    const { teams, strategy, games } = match;

    const bestOfCount = strategy.count;
    const winsToWin = Math.floor(bestOfCount / 2) + 1;

    // Calculate wins for each team
    const teamWins = teams.reduce((acc, team) => {
        acc[team.id] = team.result?.gameWins || 0;
        return acc;
    }, {} as Record<string, number>);

    // Determine if any team has reached the win threshold
    const seriesWinner = teams.find(team => teamWins[team.id] >= winsToWin);
    const isSeriesComplete = !!seriesWinner;

    // Check for match point situations
    const teamsAtMatchPoint = teams.filter(team => 
        !isSeriesComplete && isMatchPoint(teamWins[team.id], winsToWin)
    );

    const sortedGames = [...games].sort((a, b) => a.number - b.number);
    const completedGames = sortedGames.filter(game => isCompletedState(game.state));
    const nextGame = sortedGames.find(game => !isCompletedState(game.state));

    const nextGameState = normalizeState(nextGame?.state);
    const isNextGamePlayable = Boolean(
        nextGame &&
        (isUpcomingState(nextGame.state) || isLiveState(nextGame.state))
    );

    const shouldShowMatchPoint = Boolean(
        !isSeriesComplete &&
        isNextGamePlayable &&
        completedGames.length > 0 &&
        teamsAtMatchPoint.length > 0
    );

    return {
        bestOfCount,
        winsToWin,
        teamWins,
        seriesWinner,
        isSeriesComplete,
        teamsAtMatchPoint,
        nextGame,
        nextGameState,
        shouldShowMatchPoint
    };
}

/**
 * Calculates the duration of a game in seconds
 * @param game The game to calculate duration for
 * @param windowData Optional window data to get precise duration
 * @returns Duration in seconds, or null if unable to calculate
 */
export function calculateGameDuration(
    game: Game, 
    windowData?: WindowLive
): number | null {
    // If we have window data, use the first and last frame timestamps
    if (windowData?.frames && windowData.frames.length > 0) {
        const firstFrame = windowData.frames[0];
        const lastFrame = windowData.frames[windowData.frames.length - 1];
        
        if (firstFrame.rfc460Timestamp && lastFrame.rfc460Timestamp) {
            const startTime = new Date(firstFrame.rfc460Timestamp).getTime();
            const endTime = new Date(lastFrame.rfc460Timestamp).getTime();
            return Math.floor((endTime - startTime) / 1000); // Convert to seconds
        }
    }
    
    // Fallback: we could try to extract duration from game metadata if available
    // For now, return null to indicate we couldn't calculate duration
    return null;
}

/**
 * Formats a duration in seconds to a human-readable string (MM:SS or H:MM:SS)
 * @param durationSeconds Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(durationSeconds: number): string {
    if (durationSeconds < 0) return "0:00";
    
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

/**
 * Interface for series summary data structure
 */
export interface SeriesGameSummary {
    id: string;
    number: number;
    state: string;
    winnerTeamId?: string;
    sides: {
        blueTeamId: string;
        redTeamId: string;
    };
    durationSeconds?: number;
    objectives: {
        blue: {
            barons: number;
            towers: number;
            inhibitors: number;
            dragonsByType: Record<string, number>;
        };
        red: {
            barons: number;
            towers: number;
            inhibitors: number;
            dragonsByType: Record<string, number>;
        };
    };
    earlyStats: {
        gdAt10?: number;
        gdAt15?: number;
        csdAt10?: number;
        csdAt15?: number;
    };
    firsts: {
        bloodAt?: number;
        towerAt?: number;
        dragonAt?: number;
    };
    vods: Array<{
        parameter: string;
        locale: string;
        provider: string;
        offset: number;
    }>;
    roster: {
        blue: Array<{
            participantId: number;
            summonerName: string;
            championId: string;
            role: string;
        }>;
        red: Array<{
            participantId: number;
            summonerName: string;
            championId: string;
            role: string;
        }>;
    };
}

export interface SeriesSummary {
    teams: {
        id: string;
        name: string;
        code: string;
        image: string;
        seriesWins: number;
        outcome?: 'won' | 'lost';
    }[];
    bestOf: number;
    outcome?: 'won' | 'lost';
    games: SeriesGameSummary[];
    seriesMomentum: Array<{
        gameNumber: number;
        blueAdvantage: number; // Positive means blue advantage, negative means red
    }>;
}

/**
 * Builds a comprehensive series summary by combining data from multiple sources
 * @param eventId The event/match ID
 * @param gameDetails The game details from persistent API
 * @param windowDataMap Optional map of game IDs to window data
 * @returns A comprehensive series summary
 */
export function buildSeriesSummary(
    eventId: string,
    gameDetails: GameDetails,
    windowDataMap?: Map<string, WindowLive>
): SeriesSummary {
    const { match } = gameDetails.data.event;
    const { teams, games, strategy } = match;
    
    const bestOfCount = strategy.count;
    const winsToWin = Math.floor(bestOfCount / 2) + 1;
    
    // Determine winner for each game
    const gameWinners = determineSeriesWinners(gameDetails, windowDataMap);
    
    // Calculate team wins
    const teamWins = teams.reduce((acc, team) => {
        acc[team.id] = team.result?.gameWins || 0;
        return acc;
    }, {} as Record<string, number>);
    
    // Determine series winner
    const seriesWinnerId = teams.find(team => teamWins[team.id] >= winsToWin)?.id;
    
    // Sort games by number
    const sortedGames = [...games].sort((a, b) => a.number - b.number);
    
    // Build game summaries
    const gameSummaries: SeriesGameSummary[] = sortedGames.map(game => {
        const windowData = windowDataMap?.get(game.id);
        const winnerTeamId = gameWinners.get(game.id);
        
        // Get team assignments for this game
        const blueTeamInGame = game.teams.find(team => team.side === "blue");
        const redTeamInGame = game.teams.find(team => team.side === "red");
        
        // Extract objectives from window data
        const objectives = {
            blue: {
                barons: 0,
                towers: 0,
                inhibitors: 0,
                dragonsByType: {} as Record<string, number>
            },
            red: {
                barons: 0,
                towers: 0,
                inhibitors: 0,
                dragonsByType: {} as Record<string, number>
            }
        };
        
        // Extract objectives from the last frame if available
        if (windowData?.frames?.length) {
            const lastFrame = windowData.frames[windowData.frames.length - 1];
            if (lastFrame.blueTeam && lastFrame.redTeam) {
                objectives.blue.barons = lastFrame.blueTeam.barons || 0;
                objectives.blue.towers = lastFrame.blueTeam.towers || 0;
                objectives.blue.inhibitors = lastFrame.blueTeam.inhibitors || 0;
                
                objectives.red.barons = lastFrame.redTeam.barons || 0;
                objectives.red.towers = lastFrame.redTeam.towers || 0;
                objectives.red.inhibitors = lastFrame.redTeam.inhibitors || 0;
                
                // Count dragons by type
                (lastFrame.blueTeam.dragons || []).forEach(dragonType => {
                    objectives.blue.dragonsByType[dragonType] = (objectives.blue.dragonsByType[dragonType] || 0) + 1;
                });
                
                (lastFrame.redTeam.dragons || []).forEach(dragonType => {
                    objectives.red.dragonsByType[dragonType] = (objectives.red.dragonsByType[dragonType] || 0) + 1;
                });
            }
        }
        
        // Calculate early stats (would need to find frames at specific timestamps)
        const earlyStats = {
            gdAt10: undefined as number | undefined,
            gdAt15: undefined as number | undefined,
            csdAt10: undefined as number | undefined,
            csdAt15: undefined as number | undefined
        };
        
        // Find frames at 10 and 15 minutes to calculate early stats
        if (windowData?.frames?.length) {
            const gameStartTime = new Date(windowData.frames[0].rfc460Timestamp).getTime();
            const tenMinuteMark = gameStartTime + 10 * 60 * 1000;
            const fifteenMinuteMark = gameStartTime + 15 * 60 * 1000;
            
            // Find closest frames to these timestamps
            const frameAt10 = windowData.frames.find(frame =>
                Math.abs(new Date(frame.rfc460Timestamp).getTime() - tenMinuteMark) < 30000
            );
            
            const frameAt15 = windowData.frames.find(frame =>
                Math.abs(new Date(frame.rfc460Timestamp).getTime() - fifteenMinuteMark) < 30000
            );
            
            if (frameAt10?.blueTeam && frameAt10?.redTeam) {
                earlyStats.gdAt10 = frameAt10.blueTeam.totalGold - frameAt10.redTeam.totalGold;
                earlyStats.csdAt10 = frameAt10.blueTeam.participants?.reduce((sum, p) => sum + (p.creepScore || 0), 0) -
                                    frameAt10.redTeam.participants?.reduce((sum, p) => sum + (p.creepScore || 0), 0);
            }
            
            if (frameAt15?.blueTeam && frameAt15?.redTeam) {
                earlyStats.gdAt15 = frameAt15.blueTeam.totalGold - frameAt15.redTeam.totalGold;
                earlyStats.csdAt15 = frameAt15.blueTeam.participants?.reduce((sum, p) => sum + (p.creepScore || 0), 0) -
                                    frameAt15.redTeam.participants?.reduce((sum, p) => sum + (p.creepScore || 0), 0);
            }
        }
        
        // Extract first blood/tower/dragon times (would need to scan through frames)
        const firsts = {
            bloodAt: undefined as number | undefined,
            towerAt: undefined as number | undefined,
            dragonAt: undefined as number | undefined
        };
        
        // Scan frames to find first objectives
        if (windowData?.frames?.length) {
            const gameStartTime = new Date(windowData.frames[0].rfc460Timestamp).getTime();
            let firstBloodFound = false;
            let firstTowerFound = false;
            let firstDragonFound = false;
            
            for (const frame of windowData.frames) {
                if (firstBloodFound && firstTowerFound && firstDragonFound) break;
                
                const frameTime = new Date(frame.rfc460Timestamp).getTime();
                const secondsIntoGame = Math.floor((frameTime - gameStartTime) / 1000);
                
                // Check for first blood
                if (!firstBloodFound && ((frame.blueTeam.totalKills ?? 0) > 0 || (frame.redTeam.totalKills ?? 0) > 0)) {
                    firsts.bloodAt = secondsIntoGame;
                    firstBloodFound = true;
                }
                
                // Check for first tower (this is simplified - would need more complex logic)
                if (!firstTowerFound && (((frame.blueTeam.towers ?? 11) < 11) || ((frame.redTeam.towers ?? 11) < 11))) {
                    firsts.towerAt = secondsIntoGame;
                    firstTowerFound = true;
                }
                
                // Check for first dragon
                if (
                    !firstDragonFound &&
                    (
                        ((frame.blueTeam.dragons ?? []).length > 0) ||
                        ((frame.redTeam.dragons ?? []).length > 0)
                    )
                ) {
                    firsts.dragonAt = secondsIntoGame;
                    firstDragonFound = true;
                }
            }
        }
        
        // Extract roster information from metadata
        const roster = {
            blue: [] as Array<{participantId: number; summonerName: string; championId: string; role: string}>,
            red: [] as Array<{participantId: number; summonerName: string; championId: string; role: string}>
        };
        
        if (windowData?.gameMetadata) {
            const { blueTeamMetadata, redTeamMetadata } = windowData.gameMetadata;
            
            if (blueTeamMetadata?.participantMetadata) {
                roster.blue = blueTeamMetadata.participantMetadata.map(p => ({
                    participantId: p.participantId,
                    summonerName: p.summonerName,
                    championId: p.championId,
                    role: p.role
                }));
            }
            
            if (redTeamMetadata?.participantMetadata) {
                roster.red = redTeamMetadata.participantMetadata.map(p => ({
                    participantId: p.participantId,
                    summonerName: p.summonerName,
                    championId: p.championId,
                    role: p.role
                }));
            }
        }
        
        return {
            id: game.id,
            number: game.number,
            state: game.state,
            winnerTeamId: winnerTeamId || undefined,
            sides: {
                blueTeamId: blueTeamInGame?.id || teams[0]?.id,
                redTeamId: redTeamInGame?.id || teams[1]?.id
            },
            durationSeconds: calculateGameDuration(game, windowData) || undefined,
            objectives,
            earlyStats,
            firsts,
            vods: game.vods || [],
            roster
        };
    });
    
    // Calculate series momentum (early leads for each game)
    const seriesMomentum = gameSummaries.map(game => {
        // Use GD@10 as the primary indicator of early advantage
        const blueAdvantage = game.earlyStats.gdAt10 || 0;
        return {
            gameNumber: game.number,
            blueAdvantage
        };
    });
    
    // Build team summaries
    const teamSummaries = teams.map(team => ({
        id: team.id,
        name: team.name,
        code: team.code,
        image: team.image,
        seriesWins: teamWins[team.id],
        outcome: seriesWinnerId === team.id ? 'won' as const :
                  seriesWinnerId ? 'lost' as const : undefined
    }));
    
    return {
        teams: teamSummaries,
        bestOf: bestOfCount,
        outcome: seriesWinnerId === teams[0]?.id ? 'won' :
                seriesWinnerId === teams[1]?.id ? 'lost' : undefined,
        games: gameSummaries,
        seriesMomentum
    };
}
