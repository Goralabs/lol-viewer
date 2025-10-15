import React from "react";
import { SeriesScoreboard } from "./SeriesScoreboard";
import { GameDetails } from "./types/detailsPersistentTypes";
import { useSeriesSummary } from "../../hooks/useSeriesSummary";

// Mock data for testing different series formats with enhanced features
interface MockGame {
    state: string;
    winner: number | null;
    vods: Array<{
        parameter: string;
        locale: string;
        provider: string;
        offset: number;
    }>;
}

const COMPLETED_STATES = new Set(["completed", "finished", "postgame", "post_game"]);

const createMockGameDetails = (bestOf: number, games: MockGame[]): GameDetails => {
    let runningBlueWins = 0;
    let runningRedWins = 0;

    return {
        data: {
            event: {
                id: "test-event",
                type: "match",
                tournament: { id: "test-tournament" },
                league: { 
                    id: "test-league", 
                    slug: "test-league", 
                    image: "", 
                    name: "Test League" 
                },
                match: {
                    strategy: { count: bestOf },
                    teams: [
                        {
                            id: "team-1",
                            name: "Team Blue",
                            code: "BLU",
                            image: "https://via.placeholder.com/100x100/0066cc/ffffff?text=BLU",
                            result: { gameWins: games.filter(g => g.winner === 0).length }
                        },
                        {
                            id: "team-2",
                            name: "Team Red",
                            code: "RED",
                            image: "https://via.placeholder.com/100x100/cc0000/ffffff?text=RED",
                            result: { gameWins: games.filter(g => g.winner === 1).length }
                        }
                    ],
                    games: games.map((game, index) => ({
                        number: index + 1,
                        id: `game-${index + 1}`,
                        state: game.state,
                        teams: (() => {
                            const normalizedState = game.state.toLowerCase();
                            const isCompleted = COMPLETED_STATES.has(normalizedState);

                            let blueOutcome: string | undefined;
                            let redOutcome: string | undefined;

                            if (isCompleted && game.winner !== null) {
                                if (game.winner === 0) {
                                    runningBlueWins += 1;
                                    blueOutcome = "win";
                                    redOutcome = "loss";
                                } else if (game.winner === 1) {
                                    runningRedWins += 1;
                                    blueOutcome = "loss";
                                    redOutcome = "win";
                                }
                            }

                            const blueWinsAfter = runningBlueWins;
                            const redWinsAfter = runningRedWins;

                            return [
                                {
                                    id: "team-1",
                                    side: "blue",
                                    result: {
                                        gameWins: blueWinsAfter,
                                        ...(blueOutcome ? { outcome: blueOutcome } : {})
                                    }
                                },
                                {
                                    id: "team-2",
                                    side: "red",
                                    result: {
                                        gameWins: redWinsAfter,
                                        ...(redOutcome ? { outcome: redOutcome } : {})
                                    }
                                }
                            ];
                        })(),
                        vods: game.vods || []
                    }))
                },
                streams: []
            }
        }
    } as GameDetails;
};

const TestScenarios = {
    bo1_inProgress: createMockGameDetails(1, [
        { state: "inProgress", winner: null, vods: [] }
    ]),
    bo3_blueWins: createMockGameDetails(3, [
        { state: "completed", winner: 0, vods: [{ parameter: "123", locale: "en", provider: "twitch", offset: 0 }] },
        { state: "completed", winner: 1, vods: [] },
        { state: "completed", winner: 0, vods: [{ parameter: "456", locale: "en", provider: "youtube", offset: 0 }] }
    ]),
    bo5_redWins: createMockGameDetails(5, [
        { state: "completed", winner: 1, vods: [] },
        { state: "completed", winner: 1, vods: [{ parameter: "789", locale: "en", provider: "twitch", offset: 0 }] },
        { state: "completed", winner: 0, vods: [] },
        { state: "completed", winner: 1, vods: [] },
        { state: "completed", winner: 1, vods: [{ parameter: "101", locale: "en", provider: "youtube", offset: 0 }] }
    ]),
    bo3_matchPoint: createMockGameDetails(3, [
        { state: "completed", winner: 0, vods: [] },
        { state: "completed", winner: 0, vods: [] },
        { state: "inProgress", winner: null, vods: [] }
    ]),
    bo5_ongoing: createMockGameDetails(5, [
        { state: "completed", winner: 0, vods: [] },
        { state: "completed", winner: 1, vods: [{ parameter: "202", locale: "en", provider: "twitch", offset: 0 }] },
        { state: "inProgress", winner: null, vods: [] }
    ])
};

export function SeriesEnhancementsTest() {
    const [selectedScenario, setSelectedScenario] = React.useState<keyof typeof TestScenarios>("bo3_blueWins");
    const [selectedGame, setSelectedGame] = React.useState(1);
    
    const currentScenario = TestScenarios[selectedScenario];
    
    // Use the series summary hook to test the enhanced features
    const { seriesSummary, isLoading, error } = useSeriesSummary({
        eventId: "test-event",
        gameDetails: currentScenario,
        enabled: !!currentScenario
    });
    
    // Create a map of mock durations for testing
    const mockDurations = React.useMemo(() => {
        const durations = new Map<string, number | null>();
        // Add some mock durations for completed games
        durations.set("game-1", 1845); // 30:45
        durations.set("game-2", 2156); // 35:56
        durations.set("game-3", 1923); // 32:03
        durations.set("game-4", 2341); // 39:01
        durations.set("game-5", 1768); // 29:28
        return durations;
    }, []);
    
    return React.createElement('div', { 
        style: { 
            padding: "2rem", 
            maxWidth: "1200px", 
            margin: "0 auto",
            fontFamily: "Arial, sans-serif"
        } 
    },
        React.createElement('h1', { 
            style: { 
                textAlign: "center", 
                marginBottom: "2rem",
                color: "#333"
            } 
        }, "Series Enhancements Test"),
        
        // Scenario selector
        React.createElement('div', { 
            style: { 
                marginBottom: "2rem", 
                textAlign: "center",
                backgroundColor: "#f5f5f5",
                padding: "1rem",
                borderRadius: "8px"
            } 
        },
            React.createElement('label', { 
                style: { 
                    marginRight: "1rem",
                    fontWeight: "bold"
                } 
            }, "Test Scenario:"),
            React.createElement('select', {
                value: selectedScenario,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                    setSelectedScenario(e.target.value as keyof typeof TestScenarios);
                    setSelectedGame(1);
                },
                style: { 
                    padding: "0.5rem",
                    fontSize: "1rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc"
                }
            },
                Object.keys(TestScenarios).map(scenario =>
                    React.createElement('option', { key: scenario, value: scenario }, scenario)
                )
            ),
            
            // Loading and error states
            isLoading && React.createElement('div', {
                style: { 
                    marginTop: "1rem",
                    color: "#666",
                    fontStyle: "italic"
                }
            }, "Loading series data..."),
            
            error && React.createElement('div', {
                style: { 
                    marginTop: "1rem",
                    color: "#d32f2f",
                    backgroundColor: "#ffebee",
                    padding: "0.5rem",
                    borderRadius: "4px"
                }
            }, `Error: ${error}`)
        ),
        
        // Series Scoreboard
        React.createElement('div', {
            style: {
                marginBottom: "2rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
                overflow: "hidden"
            }
        },
            React.createElement('h2', {
                style: {
                    backgroundColor: "#f5f5f5",
                    margin: 0,
                    padding: "1rem",
                    borderBottom: "1px solid #ddd"
                }
            }, "Series Scoreboard Component"),
            React.createElement('div', { style: { padding: "1rem" } },
                React.createElement(SeriesScoreboard, {
                    gameDetails: currentScenario,
                    selectedGameNumber: selectedGame,
                    onGameSelect: setSelectedGame,
                    gameDurations: mockDurations
                })
            )
        ),
        
        // Series Summary Data
        React.createElement('div', {
            style: {
                marginBottom: "2rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
                overflow: "hidden"
            }
        },
            React.createElement('h2', {
                style: {
                    backgroundColor: "#f5f5f5",
                    margin: 0,
                    padding: "1rem",
                    borderBottom: "1px solid #ddd"
                }
            }, "Series Summary Data"),
            React.createElement('div', { 
                style: { 
                    padding: "1rem",
                    maxHeight: "300px",
                    overflow: "auto"
                } 
            },
                seriesSummary ? React.createElement('pre', {
                    style: {
                        backgroundColor: "#f8f8f8",
                        padding: "1rem",
                        borderRadius: "4px",
                        fontSize: "0.9rem",
                        overflow: "auto"
                    }
                }, JSON.stringify(seriesSummary, null, 2)) :
                React.createElement('p', { style: { color: "#666", fontStyle: "italic" } }, 
                    "No series summary data available")
            )
        ),
        
        // Game info
        React.createElement('div', { 
            style: { 
                padding: "1rem", 
                background: "#f5f5f5", 
                borderRadius: "4px",
                marginBottom: "2rem"
            } 
        },
            React.createElement('h3', null, "Selected Game Info:"),
            React.createElement('p', null, `Game ${selectedGame} is selected`),
            React.createElement('p', null, `Scenario: ${selectedScenario}`),
            React.createElement('p', { style: { fontSize: "0.9rem", color: "#666" } }, 
                "Note: Duration data is mocked for testing purposes")
        ),
        
        // Feature checklist
        React.createElement('div', {
            style: {
                border: "1px solid #ddd",
                borderRadius: "8px",
                overflow: "hidden"
            }
        },
            React.createElement('h2', {
                style: {
                    backgroundColor: "#f5f5f5",
                    margin: 0,
                    padding: "1rem",
                    borderBottom: "1px solid #ddd"
                }
            }, "Feature Checklist"),
            React.createElement('div', { style: { padding: "1rem" } },
                React.createElement('ul', {
                    style: {
                        listStyle: "none",
                        padding: 0,
                        margin: 0
                    }
                },
                    React.createElement('li', {
                        style: {
                            padding: "0.5rem 0",
                            borderBottom: "1px solid #eee"
                        }
                    }, "✅ Deterministic winner detection"),
                    React.createElement('li', {
                        style: {
                            padding: "0.5rem 0",
                            borderBottom: "1px solid #eee"
                        }
                    }, "✅ Match-point signaling"),
                    React.createElement('li', {
                        style: {
                            padding: "0.5rem 0",
                            borderBottom: "1px solid #eee"
                        }
                    }, "✅ Accessibility features (aria-live, aria-labels)"),
                    React.createElement('li', {
                        style: {
                            padding: "0.5rem 0",
                            borderBottom: "1px solid #eee"
                        }
                    }, "✅ Series summary aggregator"),
                    React.createElement('li', {
                        style: {
                            padding: "0.5rem 0",
                            borderBottom: "1px solid #eee"
                        }
                    }, "✅ VOD indicators on game pills"),
                    React.createElement('li', {
                        style: {
                            padding: "0.5rem 0"
                        }
                    }, "✅ Duration badges on completed games")
                )
            )
        )
    );
}
