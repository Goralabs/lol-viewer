import React, { useState, useMemo } from 'react';
import { Frame as FrameWindow } from './types/windowLiveTypes';
import { Frame as FrameDetails } from './types/detailsLiveTypes';
import { GameMetadata } from './types/windowLiveTypes';
import { toEpochMillis } from '../../utils/timestampUtils';
import { CHAMPIONS_URL } from '../../utils/LoLEsportsAPI';
import { ItemsDisplay } from './ItemsDisplay';
import './styles/playerFocusMode.css';

interface PlayerFocusModeProps {
    windowFrames: FrameWindow[];
    detailFrames: FrameDetails[];
    gameMetadata: GameMetadata;
    selectedTimestamp: number | null;
    isEnabled: boolean;
    onToggle: () => void;
}

interface PlayerStats {
    participantId: number;
    summonerName: string;
    championId: string;
    role: string;
    team: 'blue' | 'red';
    level: number;
    kills: number;
    deaths: number;
    assists: number;
    totalGold: number;
    creepScore: number;
    killParticipation: number;
    championDamageShare: number;
    wardsPlaced: number;
    wardsDestroyed: number;
    attackDamage: number;
    abilityPower: number;
    items: number[];
    abilities: string[];
}

export function PlayerFocusMode({
    windowFrames,
    detailFrames,
    gameMetadata,
    selectedTimestamp,
    isEnabled,
    onToggle
}: PlayerFocusModeProps) {
    const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

    // Get all players from metadata
    const allPlayers = useMemo(() => {
        const players: PlayerStats[] = [];
        
        // Add blue team players
        gameMetadata.blueTeamMetadata.participantMetadata.forEach(player => {
            players.push({
                participantId: player.participantId,
                summonerName: player.summonerName,
                championId: player.championId,
                role: player.role,
                team: 'blue',
                level: 1,
                kills: 0,
                deaths: 0,
                assists: 0,
                totalGold: 500,
                creepScore: 0,
                killParticipation: 0,
                championDamageShare: 0,
                wardsPlaced: 0,
                wardsDestroyed: 0,
                attackDamage: 0,
                abilityPower: 0,
                items: [],
                abilities: []
            });
        });
        
        // Add red team players
        gameMetadata.redTeamMetadata.participantMetadata.forEach(player => {
            players.push({
                participantId: player.participantId,
                summonerName: player.summonerName,
                championId: player.championId,
                role: player.role,
                team: 'red',
                level: 1,
                kills: 0,
                deaths: 0,
                assists: 0,
                totalGold: 500,
                creepScore: 0,
                killParticipation: 0,
                championDamageShare: 0,
                wardsPlaced: 0,
                wardsDestroyed: 0,
                attackDamage: 0,
                abilityPower: 0,
                items: [],
                abilities: []
            });
        });
        
        return players;
    }, [gameMetadata]);

    const targetTimestamp = useMemo(() => {
        if (selectedTimestamp !== null) {
            return selectedTimestamp;
        }

        if (!windowFrames.length) {
            return null;
        }

        const latest = windowFrames[windowFrames.length - 1];
        return toEpochMillis(latest.rfc460Timestamp);
    }, [selectedTimestamp, windowFrames]);

    // Find frames closest to the active timestamp (selected or live)
    const currentFrameData = useMemo(() => {
        if (!windowFrames.length || targetTimestamp === null) {
            return {
                window: windowFrames[windowFrames.length - 1] ?? null,
                details: detailFrames[detailFrames.length - 1] ?? null
            };
        }

        let closestWindow = windowFrames[0];
        let minWindowDiff = Math.abs(toEpochMillis(closestWindow.rfc460Timestamp) - targetTimestamp);

        windowFrames.forEach((frame) => {
            const diff = Math.abs(toEpochMillis(frame.rfc460Timestamp) - targetTimestamp);
            if (diff < minWindowDiff) {
                minWindowDiff = diff;
                closestWindow = frame;
            }
        });

        let closestDetails: FrameDetails | undefined;
        if (detailFrames.length) {
            closestDetails = detailFrames[0];
            let minDetailsDiff = Math.abs(toEpochMillis(closestDetails.rfc460Timestamp) - targetTimestamp);

            detailFrames.forEach((frame) => {
                const diff = Math.abs(toEpochMillis(frame.rfc460Timestamp) - targetTimestamp);
                if (diff < minDetailsDiff) {
                    minDetailsDiff = diff;
                    closestDetails = frame;
                }
            });
        } else {
            closestDetails = undefined;
        }

        return { window: closestWindow, details: closestDetails };
    }, [windowFrames, detailFrames, targetTimestamp]);

    // Update player stats with current frame data
    const updatedPlayers = useMemo(() => {
        const { window, details } = currentFrameData;
        
        return allPlayers.map(player => {
            const updatedPlayer = { ...player };
            
            // Update from window frame data
            if (window) {
                const teamData = player.team === 'blue' ? window.blueTeam : window.redTeam;
                const windowPlayer = teamData.participants.find(p => p.participantId === player.participantId);
                
                if (windowPlayer) {
                    updatedPlayer.level = windowPlayer.level;
                    updatedPlayer.kills = windowPlayer.kills;
                    updatedPlayer.deaths = windowPlayer.deaths;
                    updatedPlayer.assists = windowPlayer.assists;
                    updatedPlayer.totalGold = windowPlayer.totalGold;
                    updatedPlayer.creepScore = windowPlayer.creepScore;
                }
            }
            
            // Update from details frame data
            if (details) {
                const detailsPlayer = details.participants.find(p => p.participantId === player.participantId);
                
                if (detailsPlayer) {
                    updatedPlayer.killParticipation = detailsPlayer.killParticipation;
                    updatedPlayer.championDamageShare = detailsPlayer.championDamageShare;
                    updatedPlayer.wardsPlaced = detailsPlayer.wardsPlaced;
                    updatedPlayer.wardsDestroyed = detailsPlayer.wardsDestroyed;
                    updatedPlayer.attackDamage = detailsPlayer.attackDamage;
                    updatedPlayer.abilityPower = detailsPlayer.abilityPower;
                    updatedPlayer.items = detailsPlayer.items;
                    updatedPlayer.abilities = detailsPlayer.abilities;
                }
            }
            
            return updatedPlayer;
        });
    }, [allPlayers, currentFrameData]);

    const handlePlayerSelect = (player: PlayerStats) => {
        if (selectedPlayer?.participantId === player.participantId) {
            setSelectedPlayer(null);
        } else {
            setSelectedPlayer(player);
        }
    };

    const formatKDA = (kills: number, deaths: number, assists: number) => {
        const kda = deaths === 0 ? kills + assists : ((kills + assists) / deaths).toFixed(2);
        return `${kills}/${deaths}/${assists} (${kda})`;
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString();
    };

    const formatPercentage = (num: number) => {
        return `${(num * 100).toFixed(1)}%`;
    };

    if (!isEnabled) {
        return (
            <div className="player-focus-mode-toggle">
                <button className="focus-toggle-button" onClick={onToggle}>
                    <span className="toggle-icon">👤</span>
                    <span>Enable Player Focus</span>
                </button>
            </div>
        );
    }

    return (
        <div className="player-focus-mode-container">
            <div className="player-focus-header">
                <h3>Player Focus Mode</h3>
                <button className="focus-toggle-button active" onClick={onToggle}>
                    <span className="toggle-icon">✕</span>
                    <span>Disable</span>
                </button>
            </div>
            
            {!selectedPlayer ? (
                <div className="player-selection">
                    <div className="player-selection-header">Select a player to focus on:</div>
                    <div className="player-grid">
                        {updatedPlayers.map(player => (
                            <div
                                key={player.participantId}
                                className={`player-card ${player.team}`}
                                onClick={() => handlePlayerSelect(player)}
                            >
                                <div className="player-card-header">
                                    <img
                                        src={`${CHAMPIONS_URL}${player.championId}.png`}
                                        alt={player.championId}
                                        className="player-champion-icon"
                                    />
                                    <div className="player-info">
                                        <div className="player-name">{player.summonerName}</div>
                                        <div className="player-role">{player.role}</div>
                                    </div>
                                </div>
                                <div className="player-stats-summary">
                                    <div className="stat-item">
                                        <span className="stat-label">KDA</span>
                                        <span className="stat-value">{formatKDA(player.kills, player.deaths, player.assists)}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">CS</span>
                                        <span className="stat-value">{formatNumber(player.creepScore)}</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Gold</span>
                                        <span className="stat-value">{formatNumber(player.totalGold)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="player-focus-details">
                    <div className="player-focus-header-info">
                        <div className="player-champion-large">
                            <img
                                src={`${CHAMPIONS_URL}${selectedPlayer.championId}.png`}
                                alt={selectedPlayer.championId}
                            />
                            <div className="player-level">{selectedPlayer.level}</div>
                        </div>
                        <div className="player-details-info">
                            <h4>{selectedPlayer.summonerName}</h4>
                            <div className="player-meta">
                                <span className={`team-indicator ${selectedPlayer.team}`}>
                                    {selectedPlayer.team.toUpperCase()}
                                </span>
                                <span className="player-role">{selectedPlayer.role}</span>
                                <span className="player-champion-name">{selectedPlayer.championId}</span>
                            </div>
                        </div>
                        <button
                            className="back-to-selection"
                            onClick={() => setSelectedPlayer(null)}
                        >
                            ← Back to Selection
                        </button>
                    </div>
                    
                    <div className="player-focus-stats">
                        <div className="stats-section">
                            <h5>Combat Stats</h5>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-label">KDA</span>
                                    <span className="stat-value">{formatKDA(selectedPlayer.kills, selectedPlayer.deaths, selectedPlayer.assists)}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Kill Participation</span>
                                    <span className="stat-value">{formatPercentage(selectedPlayer.killParticipation)}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Damage Share</span>
                                    <span className="stat-value">{formatPercentage(selectedPlayer.championDamageShare)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="stats-section">
                            <h5>Economy</h5>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-label">Total Gold</span>
                                    <span className="stat-value">{formatNumber(selectedPlayer.totalGold)}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Creep Score</span>
                                    <span className="stat-value">{formatNumber(selectedPlayer.creepScore)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="stats-section">
                            <h5>Vision</h5>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-label">Wards Placed</span>
                                    <span className="stat-value">{formatNumber(selectedPlayer.wardsPlaced)}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Wards Destroyed</span>
                                    <span className="stat-value">{formatNumber(selectedPlayer.wardsDestroyed)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="stats-section">
                            <h5>Power</h5>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-label">Attack Damage</span>
                                    <span className="stat-value">{formatNumber(selectedPlayer.attackDamage)}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Ability Power</span>
                                    <span className="stat-value">{formatNumber(selectedPlayer.abilityPower)}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="stats-section">
                            <h5>Items</h5>
                            <div className="player-items">
                                {currentFrameData.details ? (
                                    <ItemsDisplay
                                        participantId={selectedPlayer.participantId - 1}
                                        lastFrame={currentFrameData.details}
                                    />
                                ) : (
                                    <span className="stat-placeholder">Item data unavailable</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
