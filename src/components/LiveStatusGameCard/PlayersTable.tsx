import './styles/playerStatusStyle.css'

import { GameMetadata } from "./types/windowLiveTypes";
import {GameDetails} from "./types/detailsPersistentTypes";

import {MiniHealthBar} from "./MiniHealthBar";
import React, {useEffect, useState} from "react";
import {toast} from 'react-toastify';
import {Frame as FrameDetails} from "./types/detailsLiveTypes";
import {Frame as FrameWindow, Participant as ParticipantWindow} from "./types/windowLiveTypes";

import {ReactComponent as TowerSVG} from '../../assets/images/tower.svg';
import {ReactComponent as BaronSVG} from '../../assets/images/baron.svg';
import {ReactComponent as KillSVG} from '../../assets/images/kill.svg';
import {ReactComponent as GoldSVG} from '../../assets/images/gold.svg';
import {ReactComponent as InhibitorSVG} from '../../assets/images/inhibitor.svg';

import {ReactComponent as OceanDragonSVG} from '../../assets/images/dragon-ocean.svg';
import {ReactComponent as InfernalDragonSVG} from '../../assets/images/dragon-infernal.svg';
import {ReactComponent as CloudDragonSVG} from '../../assets/images/dragon-cloud.svg';
import {ReactComponent as MountainDragonSVG} from '../../assets/images/dragon-mountain.svg';
import {ReactComponent as ElderDragonSVG} from '../../assets/images/dragon-elder.svg';
import {ReactComponent as HextechDragonSVG} from '../../assets/images/dragon-hextech.svg';
import {ReactComponent as ChemtechDragonSVG} from '../../assets/images/dragon-chemtech.svg';
import {ItemsDisplay} from "./ItemsDisplay";

import {LiveAPIWatcher} from "./LiveAPIWatcher";
import { CHAMPIONS_URL } from '../../utils/LoLEsportsAPI';
import { useResponsive } from '../../hooks/useResponsive';
import { PlayerTableSimple } from './PlayerTableSimple';
import { PlayerDetailDrawer } from './PlayerDetailDrawer';

type Props = {
    lastFrameWindow: FrameWindow,
    lastFrameDetails: FrameDetails,
    gameMetadata: GameMetadata,
    gameDetails: GameDetails,
    isLive?: boolean, // Add isLive prop to control notifications
    isFinal?: boolean, // Add isFinal prop to indicate if the game is finished
}

enum GameState {
    in_game = "LIVE",
    paused = "PAUSED",
    finished = "FINISHED"
}

export function PlayersTable({ lastFrameWindow, lastFrameDetails, gameMetadata, gameDetails, isLive = true, isFinal = false } : Props) {
    const [gameState, setGameState] = useState<GameState>(GameState[lastFrameWindow.gameState as keyof typeof GameState]);
    const [useSimpleView, setUseSimpleView] = useState(false);
    const [expandedPlayer, setExpandedPlayer] = useState<{ participantId: number, teamSide: 'blue' | 'red' } | null>(null);
    const { isMobile } = useResponsive();

    // Auto-switch to simple view on mobile
    useEffect(() => {
        setUseSimpleView(isMobile);
    }, [isMobile]);

    useEffect(() => {
        const currentGameState: GameState = GameState[lastFrameWindow.gameState as keyof typeof GameState]

        if(currentGameState !== gameState){
            setGameState(currentGameState);

            toast.info(`Game status updated: ${currentGameState.toUpperCase()}`, {
                position: "top-right",
                autoClose: 15000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
            });
        }
    }, [lastFrameWindow.gameState, gameState]);

    let blueTeam = gameDetails.data.event.match.teams[0];
    let redTeam = gameDetails.data.event.match.teams[1];

    const auxBlueTeam = blueTeam

    /*
        Sometimes teams remain wrong even after checking the last frame,
        in leagues like TCL, so we do this verification by name
    */
    const summonerName = gameMetadata.blueTeamMetadata.participantMetadata[0].summonerName.split(" ");

    if(redTeam.code.startsWith(summonerName[0])){ // We need to check only the first characters because academy teams use A, more in the tag but not in the names
        blueTeam = redTeam;
        redTeam = auxBlueTeam;
    }

    const winPrediction = getWinPrediction(
        lastFrameWindow.blueTeam.totalGold,
        lastFrameWindow.redTeam.totalGold,
        lastFrameWindow.blueTeam.towers,
        lastFrameWindow.redTeam.towers,
        lastFrameWindow.blueTeam.inhibitors,
        lastFrameWindow.redTeam.inhibitors,
        lastFrameWindow.blueTeam.barons,
        lastFrameWindow.redTeam.barons,
        lastFrameWindow.blueTeam.dragons,
        lastFrameWindow.redTeam.dragons,
        lastFrameWindow.blueTeam.totalKills,
        lastFrameWindow.redTeam.totalKills
    );

    document.title = `${blueTeam.name} VS ${redTeam.name}`;

    const toggleView = () => {
        setUseSimpleView(!useSimpleView);
    };

    const handlePlayerRowClick = (participantId: number, teamSide: 'blue' | 'red') => {
        // Only allow one drawer open at a time
        if (expandedPlayer?.participantId === participantId && expandedPlayer?.teamSide === teamSide) {
            setExpandedPlayer(null);
        } else {
            setExpandedPlayer({ participantId, teamSide });
        }
    };

    const closeDrawer = () => {
        setExpandedPlayer(null);
    };

    const getPlayerDetails = (participantId: number) => {
        const participant = lastFrameDetails.participants.find(p => p.participantId === participantId);
        return participant;
    };

    const expandedParticipantDetails = expandedPlayer
        ? getPlayerDetails(expandedPlayer.participantId)
        : null;

    return (
        <div className="status-live-game-card">

            {/* Toggle button for mobile/tablet users */}
            {isMobile && (
                <div className="simple-table-toggle">
                    <button 
                        className={`toggle-button ${useSimpleView ? 'active' : ''}`}
                        onClick={toggleView}
                    >
                        {useSimpleView ? 'View Details' : 'View Simple'}
                    </button>
                </div>
            )}

            <div className="status-live-game-card-content">
                <div className="live-game-stats-header">
                    <div className="live-game-stats-header-team-images">
                        <div className="blue-team">
                            <img src={blueTeam.image} alt={blueTeam.name}/>
                        </div>
                        <h3>{blueTeam.code}</h3>
                        <div className="live-game-stats-header-status-text">
                            <h1>VS</h1>
                            <h3>{gameState.toUpperCase()}</h3>
                        </div>
                        <h3>{redTeam.code}</h3>
                        <div className="red-team">
                            <img src={redTeam.image} alt={redTeam.name}/>
                        </div>
                    </div>
                    <div className="live-game-stats-header-status">
                        <div className="blue-team">
                            <div className="team-stats inhibitors">
                                <InhibitorSVG/>
                                {lastFrameWindow.blueTeam.inhibitors}
                            </div>
                            <div className="team-stats barons">
                                <BaronSVG/>
                                {lastFrameWindow.blueTeam.barons}
                            </div>
                            <div className="team-stats towers">
                                <TowerSVG/>
                                {lastFrameWindow.blueTeam.towers}
                            </div>
                            <div className="team-stats gold">
                                <GoldSVG/>
                                <span>
                                    {Number(lastFrameWindow.blueTeam.totalGold).toLocaleString('en-US')}
                                </span>
                            </div>
                            <div className="team-stats kills">
                                <KillSVG/>
                                {lastFrameWindow.blueTeam.totalKills}
                            </div>
                        </div>
                        <div className="red-team">
                            <div className="team-stats">
                                <InhibitorSVG/>
                                {lastFrameWindow.redTeam.inhibitors}
                            </div>
                            <div className="team-stats">
                                <BaronSVG/>
                                {lastFrameWindow.redTeam.barons}
                            </div>
                            <div className="team-stats">
                                <TowerSVG/>
                                {lastFrameWindow.redTeam.towers}
                            </div>
                            <div className="team-stats gold">
                                <GoldSVG/>
                                <span>
                                    {Number(lastFrameWindow.redTeam.totalGold).toLocaleString('en-US')}
                                </span>
                            </div>
                            <div className="team-stats">
                                <KillSVG/>
                                {lastFrameWindow.redTeam.totalKills}
                            </div>
                        </div>
                    </div>
                    <div className="win-probability-text">
                        <span className="win-probability-text-blue">
                            {winPrediction.bluePercent.toFixed(0)}%
                        </span>
                        <span className="win-probability-text-label">Win Prediction</span>
                        <span className="win-probability-text-red">
                            {winPrediction.redPercent.toFixed(0)}%
                        </span>
                    </div>
                    <div className="live-game-stats-header-gold">
                        <div className="blue-team" style={{flex: winPrediction.flexBlue}}/>
                        <div className="red-team" style={{flex: winPrediction.flexRed}}/>
                    </div>
                    <div className="live-game-stats-header-dragons">
                        <div className="blue-team">
                            {lastFrameWindow.blueTeam.dragons.map((dragon, index) => (
                                <React.Fragment key={`blue-dragon-${dragon}-${index}`}>
                                    {getDragonSVG(dragon)}
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="red-team">

                            {lastFrameWindow.redTeam.dragons.slice().reverse().map((dragon, index) => (
                                <React.Fragment key={`red-dragon-${dragon}-${index}`}>
                                    {getDragonSVG(dragon)}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Render appropriate table based on view mode */}
                {useSimpleView ? (
                    <PlayerTableSimple
                        lastFrameWindow={lastFrameWindow}
                        lastFrameDetails={lastFrameDetails}
                        gameMetadata={gameMetadata}
                        gameDetails={gameDetails}
                        blueTeam={blueTeam}
                        redTeam={redTeam}
                    />
                ) : (
                    <>
                        <table className="status-live-game-card-table">
                            <thead>
                            <tr>
                                <th className="table-top-row-champion" title="champion/team">
                                    <span>{blueTeam.name.toUpperCase()}</span>
                                </th>
                                <th className="table-top-row-vida" title="life">
                                    <span>HP</span>
                                </th>
                                <th className="table-top-row-items" title="items">
                                    <span>ITEMS</span>
                                </th>
                                <th className="table-top-row" title="creep score">
                                    <span>CS</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>K</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>D</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>A</span>
                                </th>
                                <th className="table-top-row" title="gold">
                                    <span>GOLD</span>
                                </th>
                                <th className="table-top-row" title="gold difference">
                                    <span>+/-</span>
                                </th>
                            </tr>
                            </thead>
                            <tbody>
                            {lastFrameWindow.blueTeam.participants.map((player: ParticipantWindow) => {
                                const goldDifference = getGoldDifference(player, "blue", gameMetadata, lastFrameWindow);
                                return (
                                    <tr
                                        key={`blue-player-${player.participantId}`}
                                        className={`player-row ${expandedPlayer?.participantId === player.participantId && expandedPlayer?.teamSide === 'blue' ? 'expanded' : ''}`}
                                        onClick={() => handlePlayerRowClick(player.participantId, 'blue')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handlePlayerRowClick(player.participantId, 'blue');
                                            }
                                        }}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`View details for ${gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].summonerName}`}
                                    >
                                        <th>
                                            <div className="player-champion-info">
                                                <img
                                                    src={`${CHAMPIONS_URL}${gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].championId}.png`}
                                                    className="player-champion"
                                                    alt="champion image"/>
                                                <span className=" player-champion-info-level">{player.level}</span>
                                                <div className=" player-champion-info-name">
                                                    <span>{gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].championId}</span>
                                                    <span
                                                        className=" player-card-player-name">{gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].summonerName}</span>
                                                </div>
                                            </div>
                                            {(!isMobile) && (
                                                <div className="drawer-trigger">
                                                    <span className="drawer-trigger-icon">▼</span>
                                                </div>
                                            )}
                                        </th>
                                        <td>
                                            <MiniHealthBar currentHealth={player.currentHealth} maxHealth={player.maxHealth}/>
                                        </td>
                                        <td>
                                            <ItemsDisplay participantId={player.participantId - 1} lastFrame={lastFrameDetails}/>
                                        </td>
                                        <td>
                                            <div className=" player-stats">{player.creepScore}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.kills}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.deaths}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.assists}</div>
                                        </td>
                                        <td>
                                            <div
                                                className=" player-stats">{Number(player.totalGold).toLocaleString('en-US')}</div>
                                        </td>
                                        <td>
                                            <div className={`player-stats player-gold-${goldDifference?.style}`}>{goldDifference.goldDifference}</div>
                                        </td>
                                    </tr>
                                )
                            })}
                            </tbody>
                        </table>

                        {/* Player Detail Drawer for Blue Team */}
                        {expandedPlayer?.teamSide === 'blue' && expandedParticipantDetails && (
                            <PlayerDetailDrawer
                                participant={expandedParticipantDetails}
                                teamSide="blue"
                                isVisible={true}
                                onClose={closeDrawer}
                            />
                        )}

                        <table className="status-live-game-card-table">
                            <thead>
                            <tr>
                                <th className="table-top-row-champion" title="champion/team">
                                    <span>{redTeam.name.toUpperCase()}</span>
                                </th>
                                <th className="table-top-row-vida" title="life">
                                    <span>HP</span>
                                </th>
                                <th className="table-top-row-items" title="items">
                                    <span>ITEMS</span>
                                </th>
                                <th className="table-top-row" title="creep score">
                                    <span>CS</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>K</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>D</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>A</span>
                                </th>
                                <th className="table-top-row" title="gold">
                                    <span>GOLD</span>
                                </th>
                                <th className="table-top-row" title="gold difference">
                                    <span>+/-</span>
                                </th>
                            </tr>
                            </thead>
                            <tbody>
                            {lastFrameWindow.redTeam.participants.map((player) => {
                                const goldDifference = getGoldDifference(player, "red", gameMetadata, lastFrameWindow);
                                return(
                                    <tr
                                        key={`red-player-${player.participantId}`}
                                        className={`player-row ${expandedPlayer?.participantId === player.participantId && expandedPlayer?.teamSide === 'red' ? 'expanded' : ''}`}
                                        onClick={() => handlePlayerRowClick(player.participantId, 'red')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handlePlayerRowClick(player.participantId, 'red');
                                            }
                                        }}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`View details for ${gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].summonerName}`}
                                    >
                                        <th>
                                            <div className="player-champion-info">
                                                <img
                                                    src={`${CHAMPIONS_URL}${gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].championId}.png`}
                                                    className="player-champion"
                                                    alt="champion image"/>
                                                <span className=" player-champion-info-level">{player.level}</span>
                                                <div className=" player-champion-info-name">
                                                    <span>{gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].championId}</span>
                                                    <span className=" player-card-player-name">{gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].summonerName}</span>
                                                </div>
                                            </div>
                                            {(!isMobile) && (
                                                <div className="drawer-trigger">
                                                    <span className="drawer-trigger-icon">▼</span>
                                                </div>
                                            )}
                                        </th>
                                        <td>
                                            <MiniHealthBar currentHealth={player.currentHealth} maxHealth={player.maxHealth}/>
                                        </td>
                                        <td>
                                            <ItemsDisplay participantId={player.participantId - 1} lastFrame={lastFrameDetails}/>
                                        </td>
                                        <td>
                                            <div className=" player-stats">{player.creepScore}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.kills}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.deaths}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.assists}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats">{Number(player.totalGold).toLocaleString('en-US')}</div>
                                        </td>
                                        <td>
                                            <div className={`player-stats player-gold-${goldDifference?.style}`}>{goldDifference.goldDifference}</div>
                                        </td>
                                    </tr>
                                )
                            })}
                            </tbody>
                        </table>

                        {/* Player Detail Drawer for Red Team */}
                        {expandedPlayer?.teamSide === 'red' && expandedParticipantDetails && (
                            <PlayerDetailDrawer
                                participant={expandedParticipantDetails}
                                teamSide="red"
                                isVisible={true}
                                onClose={closeDrawer}
                            />
                        )}
                    </>
                )}
            </div>

            <LiveAPIWatcher gameMetadata={gameMetadata} lastFrameWindow={lastFrameWindow} blueTeam={blueTeam} redTeam={redTeam} isLive={isLive && !isFinal}/>
        </div>
    );
}

function getGoldDifference(player: ParticipantWindow, side: string, gameMetadata: GameMetadata, frame: FrameWindow) {
    if(6 > player.participantId) { // blue side
        const redPlayer = frame.redTeam.participants[player.participantId - 1];
        const goldResult = player.totalGold - redPlayer.totalGold;

        return {
            style: goldResult > 0 ? "positive" : "negative",
            goldDifference: goldResult > 0 ? "+" + Number(goldResult).toLocaleString("en-US") : Number(goldResult).toLocaleString("en-US")
        };
    }else{
        const bluePlayer = frame.blueTeam.participants[player.participantId - 6];
        const goldResult = player.totalGold - bluePlayer.totalGold;

        return {
            style: goldResult > 0 ? "positive" : "negative",
            goldDifference: goldResult > 0 ? "+" + Number(goldResult).toLocaleString("en-US") : Number(goldResult).toLocaleString("en-US")
        };
    }
}

function getDragonSVG(dragonName: string){
    switch (dragonName) {
        case "ocean": return <OceanDragonSVG className="dragon"/>;
        case "infernal": return <InfernalDragonSVG className="dragon"/>
        case "cloud": return <CloudDragonSVG className="dragon"/>
        case "mountain": return <MountainDragonSVG className="dragon"/>
        case "hextech": return <HextechDragonSVG className="dragon"/>
        case "chemtech": return <ChemtechDragonSVG className="dragon"/>
        case "elder": return <ElderDragonSVG className="dragon"/>
    }
}

function getWinPrediction(
    goldBlue: number,
    goldRed: number,
    towersBlue: number,
    towersRed: number,
    inhibitorsBlue: number,
    inhibitorsRed: number,
    baronsBlue: number,
    baronsRed: number,
    dragonsBlue: string[],
    dragonsRed: string[],
    killsBlue: number,
    killsRed: number
) {
    const totalGold = goldBlue + goldRed;

    if (totalGold <= 0) {
        return {
            flexBlue: 1,
            flexRed: 1,
            bluePercent: 50,
            redPercent: 50,
        };
    }

    // Gold remains the main indicator of win probability.
    // Before the gold curve plateaus, a 10k lead should represent ~85% confidence.
    const goldDifference = goldBlue - goldRed;
    const GOLD_DOMINANT_DIFF = 10000;
    const GOLD_PLATEAU_START = 60000; // combined team gold where advantages begin to flatten
    const GOLD_PLATEAU_MAX_BOOST = 2.5; // amplifies early-game gold swings
    const GOLD_MIN_IMPORTANCE = 0.45; // late-game gold still matters, just less
    const LOGIT_TARGET = Math.log(0.85 / 0.15); // ~1.73, 10k lead => 85% pre-plateau
    const GOLD_BASE_SCORE = LOGIT_TARGET / 3; // align with sigmoid(x*3) below
    
    const rawGoldMultiplier = GOLD_PLATEAU_START / Math.max(totalGold, 1);
    const clampedGoldMultiplier = Math.min(
        GOLD_PLATEAU_MAX_BOOST,
        Math.max(GOLD_MIN_IMPORTANCE, rawGoldMultiplier)
    );
    const effectiveGoldDifference = goldDifference * clampedGoldMultiplier;
    const goldAdvantageScore = (effectiveGoldDifference / GOLD_DOMINANT_DIFF) * GOLD_BASE_SCORE;
    
    // Tower advantage (each tower is worth about 2% win probability)
    const towerDifference = towersBlue - towersRed;
    const towerAdvantageScore = towerDifference * 0.02;
    
    // Inhibitor advantage (each inhibitor is worth about 8% win probability)
    const inhibitorDifference = inhibitorsBlue - inhibitorsRed;
    const inhibitorAdvantageScore = inhibitorDifference * 0.08;
    
    // Baron advantage (each baron is worth about 5% win probability)
    const baronDifference = baronsBlue - baronsRed;
    const baronAdvantageScore = baronDifference * 0.05;
    
    // Dragon advantage
    // Regular dragons: 1.5% each
    // Elder dragon: 5%
    const calculateDragonScore = (dragons: string[]) => {
        let score = 0;
        dragons.forEach(dragon => {
            if (dragon === "elder") {
                score += 0.05;
            } else {
                score += 0.015;
            }
        });
        return score;
    };
    
    const dragonScoreBlue = calculateDragonScore(dragonsBlue);
    const dragonScoreRed = calculateDragonScore(dragonsRed);
    const dragonAdvantageScore = dragonScoreBlue - dragonScoreRed;
    
    // Kill advantage (diminishing returns based on total kills)
    const totalKills = killsBlue + killsRed;
    let killImportance = 1.0;
    if (totalKills > 10) {
        killImportance = Math.max(0.3, 1.0 - (totalKills - 10) / 40);
    }
    
    const killDifference = killsBlue - killsRed;
    const killAdvantageScore = (killDifference / Math.max(1, totalKills)) * killImportance * 0.1;
    
    // Combine all advantages
    const totalAdvantage = goldAdvantageScore + towerAdvantageScore +
                        inhibitorAdvantageScore + baronAdvantageScore +
                        dragonAdvantageScore + killAdvantageScore;
    
    // Apply sigmoid function to get probabilities between 0 and 1
    // This ensures we never reach 100% certainty
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x * 3)); // Multiply by 3 for steeper curve
    
    let blueWinProbability = sigmoid(totalAdvantage);
    
    // Cap extreme probabilities (never 100% certain)
    blueWinProbability = Math.max(0.05, Math.min(0.95, blueWinProbability));
    
    const redWinProbability = 1 - blueWinProbability;
    
    const bluePercent = Math.round(blueWinProbability * 100);
    const redPercent = Math.round(redWinProbability * 100);
    
    return {
        flexBlue: Math.max(blueWinProbability, 0.05),
        flexRed: Math.max(redWinProbability, 0.05),
        bluePercent,
        redPercent,
    };
}
