import React, { useMemo } from 'react';
import { Frame as FrameWindow } from './types/windowLiveTypes';
import { toEpochMillis } from '../../utils/timestampUtils';
import { ReactComponent as KillSVG } from '../../assets/images/kill.svg';
import './styles/teamfightDetector.css';

export interface TeamfightEvent {
    timestamp: number;
    gameSeconds: number;
    totalKills: number;
    goldSwing: number;
    duration: number;
    description: string;
    participants: {
        blue: number[];
        red: number[];
    };
    winner: 'blue' | 'red' | 'neutral';
}

interface TeamfightDetectorProps {
    frames: FrameWindow[];
    selectedTimestamp: number | null;
    onTimestampClick: (timestamp: number) => void;
}

type KillEvent = {
    timestamp: number;
    team: 'blue' | 'red';
    kills: number;
    gold: number;
};

const TEAMFIGHT_WINDOW_MS = 15000;
const MIN_KILLS_FOR_TEAMFIGHT = 3;
const MIN_GOLD_SWING = 2000;

function evaluateTeamfight(
    kills: KillEvent[],
    gameStartTime: number
): TeamfightEvent {
    const startTimestamp = kills[0].timestamp;
    const endTimestamp = kills[kills.length - 1].timestamp;

    const blueKills = kills
        .filter((k) => k.team === 'blue')
        .reduce((sum, k) => sum + k.kills, 0);
    const redKills = kills
        .filter((k) => k.team === 'red')
        .reduce((sum, k) => sum + k.kills, 0);
    const totalKills = blueKills + redKills;

    const blueGold = kills
        .filter((k) => k.team === 'blue')
        .reduce((sum, k) => sum + k.gold, 0);
    const redGold = kills
        .filter((k) => k.team === 'red')
        .reduce((sum, k) => sum + k.gold, 0);
    const goldSwing = Math.abs(blueGold - redGold);

    const duration = endTimestamp - startTimestamp;
    const gameSeconds = Math.floor((startTimestamp - gameStartTime) / 1000);

    let winner: 'blue' | 'red' | 'neutral';
    if (blueKills > redKills) {
        winner = 'blue';
    } else if (redKills > blueKills) {
        winner = 'red';
    } else {
        winner = 'neutral';
    }

    const description =
        winner === 'blue'
            ? `Blue wins teamfight ${blueKills}-${redKills}`
            : winner === 'red'
                ? `Red wins teamfight ${redKills}-${blueKills}`
                : `Even teamfight ${blueKills}-${redKills}`;

    return {
        timestamp: startTimestamp,
        gameSeconds,
        totalKills,
        goldSwing,
        duration,
        description,
        participants: {
            blue: [],
            red: [],
        },
        winner,
    };
}

export function detectTeamfights(frames: FrameWindow[]): TeamfightEvent[] {
    if (!frames.length) return [];

    const events: TeamfightEvent[] = [];
    const gameStartTime = toEpochMillis(frames[0].rfc460Timestamp);
    const killEvents: KillEvent[] = [];

    frames.forEach((frame, index) => {
        const timestamp = toEpochMillis(frame.rfc460Timestamp);
        const blueKills = frame.blueTeam.totalKills || 0;
        const redKills = frame.redTeam.totalKills || 0;
        const blueGold = frame.blueTeam.totalGold || 0;
        const redGold = frame.redTeam.totalGold || 0;

        if (index > 0) {
            const prevFrame = frames[index - 1];
            const prevBlueKills = prevFrame.blueTeam.totalKills || 0;
            const prevRedKills = prevFrame.redTeam.totalKills || 0;
            const prevBlueGold = prevFrame.blueTeam.totalGold || 0;
            const prevRedGold = prevFrame.redTeam.totalGold || 0;

            if (blueKills > prevBlueKills) {
                killEvents.push({
                    timestamp,
                    team: 'blue',
                    kills: blueKills - prevBlueKills,
                    gold: blueGold - prevBlueGold,
                });
            }

            if (redKills > prevRedKills) {
                killEvents.push({
                    timestamp,
                    team: 'red',
                    kills: redKills - prevRedKills,
                    gold: redGold - prevRedGold,
                });
            }
        }
    });

    let currentTeamfight: KillEvent[] = [];
    let teamfightStart = 0;

    killEvents.forEach((kill) => {
        if (currentTeamfight.length === 0) {
            currentTeamfight.push(kill);
            teamfightStart = kill.timestamp;
            return;
        }

        const withinWindow = kill.timestamp - teamfightStart <= TEAMFIGHT_WINDOW_MS;
        if (withinWindow) {
            currentTeamfight.push(kill);
            return;
        }

        if (currentTeamfight.length >= MIN_KILLS_FOR_TEAMFIGHT) {
            const teamfight = evaluateTeamfight(currentTeamfight, gameStartTime);
            if (teamfight.goldSwing >= MIN_GOLD_SWING) {
                events.push(teamfight);
            }
        }

        currentTeamfight = [kill];
        teamfightStart = kill.timestamp;
    });

    if (currentTeamfight.length >= MIN_KILLS_FOR_TEAMFIGHT) {
        const teamfight = evaluateTeamfight(currentTeamfight, gameStartTime);
        if (teamfight.goldSwing >= MIN_GOLD_SWING) {
            events.push(teamfight);
        }
    }

    return events;
}

export function TeamfightDetector({
    frames,
    selectedTimestamp,
    onTimestampClick,
}: TeamfightDetectorProps) {
    const teamfights = useMemo(() => detectTeamfights(frames), [frames]);

    const formatGameTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        return `${seconds}s`;
    };

    const formatGoldSwing = (gold: number) => {
        return `${Math.round(gold / 1000)}k`;
    };

    const handleTeamfightClick = (timestamp: number) => {
        onTimestampClick(timestamp);
    };

    if (!teamfights.length) {
        return (
            <div className="teamfight-detector-container">
                <div className="teamfight-detector-header">Teamfights</div>
                <div className="teamfight-detector-empty">No teamfights detected yet</div>
            </div>
        );
    }

    return (
        <div className="teamfight-detector-container">
            <div className="teamfight-detector-header">Teamfights</div>
            <div className="teamfight-list">
                {teamfights.map((teamfight, index) => (
                    <div
                        key={`${teamfight.timestamp}-${index}`}
                        className={`teamfight-event ${teamfight.winner} ${selectedTimestamp === teamfight.timestamp ? 'selected' : ''}`}
                        onClick={() => handleTeamfightClick(teamfight.timestamp)}
                    >
                        <div className="teamfight-icon">
                            <KillSVG className="kill-icon" />
                        </div>
                        <div className="teamfight-content">
                            <div className="teamfight-description">
                                {teamfight.description}
                            </div>
                            <div className="teamfight-details">
                                <span className="teamfight-time">
                                    {formatGameTime(teamfight.gameSeconds)}
                                </span>
                                <span className="teamfight-stats">
                                    {teamfight.totalKills} kills • {formatGoldSwing(teamfight.goldSwing)} gold • {formatDuration(teamfight.duration)}
                                </span>
                            </div>
                        </div>
                        {selectedTimestamp === teamfight.timestamp && (
                            <div className="teamfight-selected-indicator">●</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
