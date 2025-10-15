import React from "react";
import { SeriesScoreboard } from "./SeriesScoreboard";
import { GameDetails } from "./types/detailsPersistentTypes";
import { WindowLive } from "./types/windowLiveTypes";

/**
 * Test component to verify deterministic series pill coloring
 * This simulates the Worlds IG vs T1 example with red - blue - red - red pattern
 */
export function SeriesPillColoringTest() {
    // Mock data for Worlds IG vs T1 series (red - blue - red - red pattern)
    const mockGameDetails: GameDetails = {
        data: {
            event: {
                match: {
                    teams: [
                        {
                            id: "team-ig",
                            name: "Invictus Gaming",
                            code: "IG",
                            image: "/images/ig-logo.png",
                            result: { gameWins: 1, outcome: "lost" }
                        },
                        {
                            id: "team-t1",
                            name: "T1",
                            code: "T1", 
                            image: "/images/t1-logo.png",
                            result: { gameWins: 3, outcome: "win" }
                        }
                    ],
                    games: [
                        {
                            id: "game1",
                            number: 1,
                            state: "completed",
                            teams: [
                                { id: "team-t1", side: "blue", result: { gameWins: 1, outcome: "win" } },
                                { id: "team-ig", side: "red", result: { gameWins: 0, outcome: "loss" } }
                            ],
                            vods: []
                        },
                        {
                            id: "game2", 
                            number: 2,
                            state: "completed",
                            teams: [
                                { id: "team-ig", side: "blue", result: { gameWins: 1, outcome: "win" } },
                                { id: "team-t1", side: "red", result: { gameWins: 1, outcome: "loss" } }
                            ],
                            vods: []
                        },
                        {
                            id: "game3",
                            number: 3,
                            state: "completed", 
                            teams: [
                                { id: "team-t1", side: "blue", result: { gameWins: 2, outcome: "win" } },
                                { id: "team-ig", side: "red", result: { gameWins: 1, outcome: "loss" } }
                            ],
                            vods: []
                        },
                        {
                            id: "game4",
                            number: 4,
                            state: "completed",
                            teams: [
                                { id: "team-t1", side: "blue", result: { gameWins: 3, outcome: "win" } },
                                { id: "team-ig", side: "red", result: { gameWins: 1, outcome: "loss" } }
                            ],
                            vods: []
                        }
                    ],
                    strategy: { count: 5 }
                }
            }
        }
    } as GameDetails;

    // Mock window data that simulates the final game state for each game
    const mockWindowDataMap = new Map<string, WindowLive>();

    // Game 1: T1 wins (red team in game, but right team in series = red pill)
    mockWindowDataMap.set("game1", {
        esportsGameId: "game1",
        esportsMatchId: "match-ig-t1",
        gameMetadata: {
            patchVersion: "13.1",
            blueTeamMetadata: {
                esportsTeamId: "team-t1",
                participantMetadata: []
            },
            redTeamMetadata: {
                esportsTeamId: "team-ig", 
                participantMetadata: []
            }
        },
        frames: [
            {
                rfc460Timestamp: new Date("2023-10-01T12:00:00Z"),
                gameState: "finished",
                blueTeam: {
                    totalGold: 85000,
                    inhibitors: 0,
                    towers: 11,
                    barons: 2,
                    totalKills: 25,
                    dragons: ["infernal", "mountain"],
                    participants: []
                },
                redTeam: {
                    totalGold: 65000,
                    inhibitors: 3,
                    towers: 3,
                    barons: 0,
                    totalKills: 12,
                    dragons: [],
                    participants: []
                }
            }
        ]
    });

    // Game 2: IG wins (blue team in game, but left team in series = blue pill)
    mockWindowDataMap.set("game2", {
        esportsGameId: "game2",
        esportsMatchId: "match-ig-t1",
        gameMetadata: {
            patchVersion: "13.1",
            blueTeamMetadata: {
                esportsTeamId: "team-ig",
                participantMetadata: []
            },
            redTeamMetadata: {
                esportsTeamId: "team-t1",
                participantMetadata: []
            }
        },
        frames: [
            {
                rfc460Timestamp: new Date("2023-10-01T15:00:00Z"),
                gameState: "finished",
                blueTeam: {
                    totalGold: 75000,
                    inhibitors: 0,
                    towers: 8,
                    barons: 1,
                    totalKills: 20,
                    dragons: ["ocean", "cloud"],
                    participants: []
                },
                redTeam: {
                    totalGold: 55000,
                    inhibitors: 2,
                    towers: 4,
                    barons: 0,
                    totalKills: 10,
                    dragons: [],
                    participants: []
                }
            }
        ]
    });

    // Game 3: T1 wins (blue team in game, but right team in series = red pill)
    mockWindowDataMap.set("game3", {
        esportsGameId: "game3",
        esportsMatchId: "match-ig-t1",
        gameMetadata: {
            patchVersion: "13.1",
            blueTeamMetadata: {
                esportsTeamId: "team-t1",
                participantMetadata: []
            },
            redTeamMetadata: {
                esportsTeamId: "team-ig",
                participantMetadata: []
            }
        },
        frames: [
            {
                rfc460Timestamp: new Date("2023-10-01T18:00:00Z"),
                gameState: "finished",
                blueTeam: {
                    totalGold: 92000,
                    inhibitors: 0,
                    towers: 9,
                    barons: 3,
                    totalKills: 30,
                    dragons: ["infernal", "mountain", "chemtech"],
                    participants: []
                },
                redTeam: {
                    totalGold: 60000,
                    inhibitors: 1,
                    towers: 2,
                    barons: 0,
                    totalKills: 8,
                    dragons: ["cloud"],
                    participants: []
                }
            }
        ]
    });

    // Game 4: T1 wins (blue team in game, but right team in series = red pill)
    mockWindowDataMap.set("game4", {
        esportsGameId: "game4",
        esportsMatchId: "match-ig-t1",
        gameMetadata: {
            patchVersion: "13.1",
            blueTeamMetadata: {
                esportsTeamId: "team-t1",
                participantMetadata: []
            },
            redTeamMetadata: {
                esportsTeamId: "team-ig",
                participantMetadata: []
            }
        },
        frames: [
            {
                rfc460Timestamp: new Date("2023-10-01T21:00:00Z"),
                gameState: "finished",
                blueTeam: {
                    totalGold: 88000,
                    inhibitors: 0,
                    towers: 10,
                    barons: 2,
                    totalKills: 28,
                    dragons: ["elder", "infernal"],
                    participants: []
                },
                redTeam: {
                    totalGold: 0, // Nexus destroyed
                    inhibitors: 0,
                    towers: 0,
                    barons: 0,
                    totalKills: 15,
                    dragons: ["mountain"],
                    participants: []
                }
            }
        ]
    });

    const handleGameSelect = (gameNumber: number) => {
    };

    return (
        <div style={{ padding: "2rem", backgroundColor: "#1a1a1a", color: "white" }}>
            <h2>Series Pill Coloring Test - Worlds IG vs T1</h2>
            <p>Expected pattern: red - blue - red - red</p>
            <p>Left team (IG) should have blue theme, Right team (T1) should have red theme</p>
            
            <SeriesScoreboard
                gameDetails={mockGameDetails}
                selectedGameNumber={1}
                onGameSelect={handleGameSelect}
                windowDataMap={mockWindowDataMap}
            />
            
            <div style={{ marginTop: "2rem", fontSize: "0.9rem", opacity: 0.8 }}>
                <p>Open browser dev tools and inspect the game pills to verify CSS classes:</p>
                <ul>
                    <li>Game 1 should have class "team-right-win" (T1 won, right team)</li>
                    <li>Game 2 should have class "team-left-win" (IG won, left team)</li>
                    <li>Game 3 should have class "team-right-win" (T1 won, right team)</li>
                    <li>Game 4 should have class "team-right-win" (T1 won, right team)</li>
                </ul>
            </div>
        </div>
    );
}
