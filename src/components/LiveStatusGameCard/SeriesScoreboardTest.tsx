import React from "react";
import { SeriesScoreboard } from "./SeriesScoreboard";
import { GameDetails } from "./types/detailsPersistentTypes";

// Mock data for testing different series formats
const createMockGameDetails = (bestOf: number, games: any[]): GameDetails => {
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
                        teams: [
                            { id: "team-1", side: "blue" },
                            { id: "team-2", side: "red" }
                        ],
                        vods: []
                    }))
                },
                streams: []
            }
        }
    } as GameDetails;
};

const TestScenarios = {
    bo1_inProgress: createMockGameDetails(1, [
        { state: "inProgress", winner: null }
    ]),
    bo3_blueWins: createMockGameDetails(3, [
        { state: "completed", winner: 0 },
        { state: "completed", winner: 1 },
        { state: "completed", winner: 0 }
    ]),
    bo5_redWins: createMockGameDetails(5, [
        { state: "completed", winner: 1 },
        { state: "completed", winner: 1 },
        { state: "completed", winner: 0 },
        { state: "completed", winner: 1 },
        { state: "completed", winner: 1 }
    ]),
    bo3_ongoing: createMockGameDetails(3, [
        { state: "completed", winner: 0 },
        { state: "inProgress", winner: null }
    ])
};

export function SeriesScoreboardTest() {
    const [selectedScenario, setSelectedScenario] = React.useState<keyof typeof TestScenarios>("bo3_blueWins");
    const [selectedGame, setSelectedGame] = React.useState(1);
    
    const currentScenario = TestScenarios[selectedScenario];
    
    return React.createElement('div', { style: { padding: "2rem", maxWidth: "800px", margin: "0 auto" } },
        React.createElement('h1', { style: { textAlign: "center", marginBottom: "2rem" } }, "Series Scoreboard Test"),
        
        // Scenario selector
        React.createElement('div', { style: { marginBottom: "2rem", textAlign: "center" } },
            React.createElement('label', { style: { marginRight: "1rem" } }, "Test Scenario:"),
            React.createElement('select', {
                value: selectedScenario,
                onChange: (e: any) => {
                    setSelectedScenario(e.target.value);
                    setSelectedGame(1);
                },
                style: { padding: "0.5rem" }
            },
                Object.keys(TestScenarios).map(scenario =>
                    React.createElement('option', { key: scenario, value: scenario }, scenario)
                )
            )
        ),
        
        // Series Scoreboard
        React.createElement(SeriesScoreboard, {
            gameDetails: currentScenario,
            selectedGameNumber: selectedGame,
            onGameSelect: setSelectedGame
        }),
        
        // Game info
        React.createElement('div', { style: { marginTop: "2rem", padding: "1rem", background: "#f5f5f5", borderRadius: "4px" } },
            React.createElement('h3', null, "Selected Game Info:"),
            React.createElement('p', null, `Game ${selectedGame} is selected`),
            React.createElement('p', null, `Scenario: ${selectedScenario}`)
        )
    );
}