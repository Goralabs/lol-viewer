import React, { useMemo } from 'react';
import { Frame as FrameWindow } from './types/windowLiveTypes';
import { Frame as FrameDetails } from './types/detailsLiveTypes';
import { toEpochMillis } from '../../utils/timestampUtils';
import { GameMetadata } from './types/windowLiveTypes';
import './styles/laneDeltas.css';

interface LaneStats {
    role: string;
    participantId: number;
    summonerName: string;
    championId: string;
    team: 'blue' | 'red';
    opponentId?: number;
    opponentName?: string;
}

interface DeltaStats {
    goldDiff: number;
    csDiff: number;
    xpDiff: number;
}

interface LaneDeltasProps {
    windowFrames: FrameWindow[];
    detailFrames: FrameDetails[];
    gameMetadata: GameMetadata;
}

interface RoleMatchup {
    blue: LaneStats;
    red: LaneStats;
}

export function LaneDeltas({ windowFrames, detailFrames, gameMetadata }: LaneDeltasProps) {
    // Create role matchups based on participant metadata
    const roleMatchups = useMemo(() => {
        const matchups: RoleMatchup[] = [];
        
        // Map participants by role
        const blueParticipants = gameMetadata.blueTeamMetadata.participantMetadata;
        const redParticipants = gameMetadata.redTeamMetadata.participantMetadata;
        
        // Create matchups by role (TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY)
        const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
        
        roles.forEach(role => {
            const bluePlayer = blueParticipants.find(p => p.role === role);
            const redPlayer = redParticipants.find(p => p.role === role);
            
            if (bluePlayer && redPlayer) {
                matchups.push({
                    blue: {
                        role,
                        participantId: bluePlayer.participantId,
                        summonerName: bluePlayer.summonerName,
                        championId: bluePlayer.championId,
                        team: 'blue',
                        opponentId: redPlayer.participantId,
                        opponentName: redPlayer.summonerName
                    },
                    red: {
                        role,
                        participantId: redPlayer.participantId,
                        summonerName: redPlayer.summonerName,
                        championId: redPlayer.championId,
                        team: 'red',
                        opponentId: bluePlayer.participantId,
                        opponentName: bluePlayer.summonerName
                    }
                });
            }
        });
        
        return matchups;
    }, [gameMetadata]);

    // Find frames closest to specific timestamps (10 and 15 minutes)
    const findFrameAtTime = (targetMinutes: number): { window?: FrameWindow; details?: FrameDetails } => {
        if (!windowFrames.length) return {};
        
        const gameStartTime = toEpochMillis(windowFrames[0].rfc460Timestamp);
        const targetTime = gameStartTime + (targetMinutes * 60 * 1000);
        
        // Find closest window frame
        let closestWindow = windowFrames[0];
        let minWindowDiff = Math.abs(toEpochMillis(closestWindow.rfc460Timestamp) - targetTime);
        
        windowFrames.forEach(frame => {
            const diff = Math.abs(toEpochMillis(frame.rfc460Timestamp) - targetTime);
            if (diff < minWindowDiff) {
                minWindowDiff = diff;
                closestWindow = frame;
            }
        });
        
        // Find closest details frame
        let closestDetails: FrameDetails | undefined;
        if (detailFrames.length) {
            closestDetails = detailFrames[0];
            let minDetailsDiff = Math.abs(toEpochMillis(closestDetails.rfc460Timestamp) - targetTime);
            
            detailFrames.forEach(frame => {
                const diff = Math.abs(toEpochMillis(frame.rfc460Timestamp) - targetTime);
                if (diff < minDetailsDiff) {
                    minDetailsDiff = diff;
                    closestDetails = frame;
                }
            });
        }
        
        // Only return frames if they're within 30 seconds of target time
        if (minWindowDiff > 30000) {
            return { details: closestDetails };
        }
        
        return { window: closestWindow, details: closestDetails };
    };

    // Calculate deltas for a specific time
    const calculateDeltasAtTime = (targetMinutes: number): DeltaStats[] => {
        const { window, details } = findFrameAtTime(targetMinutes);
        const deltas: DeltaStats[] = [];
        
        roleMatchups.forEach(matchup => {
            let goldDiff = 0;
            let csDiff = 0;
            let xpDiff = 0;
            
            // Calculate gold difference from window data
            if (window) {
                const blueWindowPlayer = window.blueTeam.participants.find(p => p.participantId === matchup.blue.participantId);
                const redWindowPlayer = window.redTeam.participants.find(p => p.participantId === matchup.red.participantId);
                
                if (blueWindowPlayer && redWindowPlayer) {
                    goldDiff = blueWindowPlayer.totalGold - redWindowPlayer.totalGold;
                    csDiff = blueWindowPlayer.creepScore - redWindowPlayer.creepScore;
                }
            }
            
            // Calculate XP difference from details data
            if (details) {
                const blueDetailsPlayer = details.participants.find(p => p.participantId === matchup.blue.participantId);
                const redDetailsPlayer = details.participants.find(p => p.participantId === matchup.red.participantId);
                
                if (blueDetailsPlayer && redDetailsPlayer) {
                    // XP is not directly available, but we can estimate from level
                    // This is a simplified calculation - in a real implementation you'd want actual XP data
                    const blueXP = blueDetailsPlayer.level * 1000; // Rough estimate
                    const redXP = redDetailsPlayer.level * 1000; // Rough estimate
                    xpDiff = blueXP - redXP;
                }
            }
            
            deltas.push({
                goldDiff,
                csDiff,
                xpDiff
            });
        });
        
        return deltas;
    };

    // Calculate deltas at 10 and 15 minutes
    const deltasAt10 = useMemo(() => calculateDeltasAtTime(10), [windowFrames, detailFrames, roleMatchups]);
    const deltasAt15 = useMemo(() => calculateDeltasAtTime(15), [windowFrames, detailFrames, roleMatchups]);

    // Format delta values for display
    const formatDelta = (value: number, isGold: boolean = false) => {
        if (value === 0) return '0';
        const sign = value > 0 ? '+' : '';
        if (isGold) {
            return `${sign}${value.toLocaleString()}`;
        }
        return `${sign}${value}`;
    };

    const getDeltaClass = (value: number) => {
        if (value > 0) return 'positive';
        if (value < 0) return 'negative';
        return 'neutral';
    };

    if (!windowFrames.length) {
        return (
            <div className="lane-deltas-container">
                <div className="lane-deltas-header">Lane Deltas</div>
                <div className="lane-deltas-empty">No data available</div>
            </div>
        );
    }

    return (
        <div className="lane-deltas-container">
            <div className="lane-deltas-header">Lane Deltas</div>
            
            <div className="lane-deltas-content">
                <div className="delta-time-section">
                    <div className="delta-time-header">10 Minutes</div>
                    <div className="delta-matchups">
                        {roleMatchups.map((matchup, index) => (
                            <div key={`10m-${matchup.blue.role}`} className="delta-matchup">
                                <div className="player-info blue">
                                    <span className="role">{matchup.blue.role}</span>
                                    <span className="name">{matchup.blue.summonerName}</span>
                                </div>
                                <div className="delta-stats">
                                    <div className={`delta-stat ${getDeltaClass(deltasAt10[index]?.goldDiff)}`}>
                                        <span className="stat-label">GOLD</span>
                                        <span className="stat-value">{formatDelta(deltasAt10[index]?.goldDiff || 0, true)}</span>
                                    </div>
                                    <div className={`delta-stat ${getDeltaClass(deltasAt10[index]?.csDiff)}`}>
                                        <span className="stat-label">CS</span>
                                        <span className="stat-value">{formatDelta(deltasAt10[index]?.csDiff || 0)}</span>
                                    </div>
                                    <div className={`delta-stat ${getDeltaClass(deltasAt10[index]?.xpDiff)}`}>
                                        <span className="stat-label">XP</span>
                                        <span className="stat-value">{formatDelta(deltasAt10[index]?.xpDiff || 0)}</span>
                                    </div>
                                </div>
                                <div className="player-info red">
                                    <span className="name">{matchup.red.summonerName}</span>
                                    <span className="role">{matchup.red.role}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="delta-time-section">
                    <div className="delta-time-header">15 Minutes</div>
                    <div className="delta-matchups">
                        {roleMatchups.map((matchup, index) => (
                            <div key={`15m-${matchup.blue.role}`} className="delta-matchup">
                                <div className="player-info blue">
                                    <span className="role">{matchup.blue.role}</span>
                                    <span className="name">{matchup.blue.summonerName}</span>
                                </div>
                                <div className="delta-stats">
                                    <div className={`delta-stat ${getDeltaClass(deltasAt15[index]?.goldDiff)}`}>
                                        <span className="stat-label">GOLD</span>
                                        <span className="stat-value">{formatDelta(deltasAt15[index]?.goldDiff || 0, true)}</span>
                                    </div>
                                    <div className={`delta-stat ${getDeltaClass(deltasAt15[index]?.csDiff)}`}>
                                        <span className="stat-label">CS</span>
                                        <span className="stat-value">{formatDelta(deltasAt15[index]?.csDiff || 0)}</span>
                                    </div>
                                    <div className={`delta-stat ${getDeltaClass(deltasAt15[index]?.xpDiff)}`}>
                                        <span className="stat-label">XP</span>
                                        <span className="stat-value">{formatDelta(deltasAt15[index]?.xpDiff || 0)}</span>
                                    </div>
                                </div>
                                <div className="player-info red">
                                    <span className="name">{matchup.red.summonerName}</span>
                                    <span className="role">{matchup.red.role}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}