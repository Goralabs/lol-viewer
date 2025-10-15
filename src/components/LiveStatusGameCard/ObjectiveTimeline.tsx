import React, { useMemo } from 'react';
import { Frame as FrameWindow } from './types/windowLiveTypes';
import { toEpochMillis } from '../../utils/timestampUtils';
import { ReactComponent as TowerSVG } from '../../assets/images/tower.svg';
import { ReactComponent as BaronSVG } from '../../assets/images/baron.svg';
import { ReactComponent as KillSVG } from '../../assets/images/kill.svg';
import { ReactComponent as InhibitorSVG } from '../../assets/images/inhibitor.svg';
import { ReactComponent as OceanDragonSVG } from '../../assets/images/dragon-ocean.svg';
import { ReactComponent as InfernalDragonSVG } from '../../assets/images/dragon-infernal.svg';
import { ReactComponent as CloudDragonSVG } from '../../assets/images/dragon-cloud.svg';
import { ReactComponent as MountainDragonSVG } from '../../assets/images/dragon-mountain.svg';
import { ReactComponent as ElderDragonSVG } from '../../assets/images/dragon-elder.svg';
import { ReactComponent as HextechDragonSVG } from '../../assets/images/dragon-hextech.svg';
import { ReactComponent as ChemtechDragonSVG } from '../../assets/images/dragon-chemtech.svg';
import './styles/objectiveTimeline.css';
import { TeamfightEvent } from './TeamfightDetector';

interface ObjectiveEvent {
    timestamp: number;
    type: 'firstBlood' | 'firstTower' | 'dragon' | 'baron' | 'inhibitor' | 'tower' | 'teamfight';
    team: 'blue' | 'red' | 'neutral';
    description: string;
    gameSeconds: number;
}

interface ObjectiveTimelineProps {
    frames: FrameWindow[];
    selectedTimestamp: number | null;
    onTimestampClick: (timestamp: number) => void;
    teamfightEvents?: TeamfightEvent[];
}

export function ObjectiveTimeline({
    frames,
    selectedTimestamp,
    onTimestampClick,
    teamfightEvents = []
}: ObjectiveTimelineProps) {
    // Process frames to extract objective events
    const objectiveEvents = useMemo(() => {
        if (!frames.length) return [];

        const events: ObjectiveEvent[] = [];
        let previousFrame: FrameWindow | null = null;
        const gameStartTime = toEpochMillis(frames[0].rfc460Timestamp);

        frames.forEach((frame) => {
            const currentTimestamp = toEpochMillis(frame.rfc460Timestamp);
            const gameSeconds = Math.floor((currentTimestamp - gameStartTime) / 1000);

            if (previousFrame) {
                
                // Check for first blood
                if (previousFrame.blueTeam.totalKills === 0 && previousFrame.redTeam.totalKills === 0) {
                    if (frame.blueTeam.totalKills > 0) {
                        events.push({
                            timestamp: currentTimestamp,
                            type: 'firstBlood',
                            team: 'blue',
                            description: 'First Blood',
                            gameSeconds
                        });
                    } else if (frame.redTeam.totalKills > 0) {
                        events.push({
                            timestamp: currentTimestamp,
                            type: 'firstBlood',
                            team: 'red',
                            description: 'First Blood',
                            gameSeconds
                        });
                    }
                }

                // Check for first tower
                if (previousFrame.blueTeam.towers === 11 && previousFrame.redTeam.towers === 11) {
                    if (frame.blueTeam.towers < 11) {
                        events.push({
                            timestamp: currentTimestamp,
                            type: 'firstTower',
                            team: 'red',
                            description: 'First Tower',
                            gameSeconds
                        });
                    } else if (frame.redTeam.towers < 11) {
                        events.push({
                            timestamp: currentTimestamp,
                            type: 'firstTower',
                            team: 'blue',
                            description: 'First Tower',
                            gameSeconds
                        });
                    }
                }

                // Check for additional dragons
                const totalDragonsBefore =
                    previousFrame.blueTeam.dragons.length + previousFrame.redTeam.dragons.length;
                let firstDragonPending = totalDragonsBefore === 0;
                const blueDragonDiff = frame.blueTeam.dragons.length - previousFrame.blueTeam.dragons.length;
                const redDragonDiff = frame.redTeam.dragons.length - previousFrame.redTeam.dragons.length;
                
                if (blueDragonDiff > 0) {
                    const newDragons = frame.blueTeam.dragons.slice(-blueDragonDiff);
                    newDragons.forEach(dragonType => {
                        const normalizedType = dragonType.toLowerCase();
                        const formattedType = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
                        const isFirstDragon = firstDragonPending;
                        events.push({
                            timestamp: currentTimestamp,
                            type: 'dragon',
                            team: 'blue',
                            description: `${formattedType} Dragon${isFirstDragon ? ' (First Dragon)' : ''}`,
                            gameSeconds
                        });
                        if (isFirstDragon) {
                            firstDragonPending = false;
                        }
                    });
                }
                
                if (redDragonDiff > 0) {
                    const newDragons = frame.redTeam.dragons.slice(-redDragonDiff);
                    newDragons.forEach(dragonType => {
                        const normalizedType = dragonType.toLowerCase();
                        const formattedType = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1);
                        const isFirstDragon = firstDragonPending;
                        events.push({
                            timestamp: currentTimestamp,
                            type: 'dragon',
                            team: 'red',
                            description: `${formattedType} Dragon${isFirstDragon ? ' (First Dragon)' : ''}`,
                            gameSeconds
                        });
                        if (isFirstDragon) {
                            firstDragonPending = false;
                        }
                    });
                }

                // Check for barons
                if (frame.blueTeam.barons > previousFrame.blueTeam.barons) {
                    events.push({
                        timestamp: currentTimestamp,
                        type: 'baron',
                        team: 'blue',
                        description: 'Baron Nashor',
                        gameSeconds
                    });
                }
                
                if (frame.redTeam.barons > previousFrame.redTeam.barons) {
                    events.push({
                        timestamp: currentTimestamp,
                        type: 'baron',
                        team: 'red',
                        description: 'Baron Nashor',
                        gameSeconds
                    });
                }

                // Check for inhibitors
                if (frame.blueTeam.inhibitors > previousFrame.blueTeam.inhibitors) {
                    events.push({
                        timestamp: currentTimestamp,
                        type: 'inhibitor',
                        team: 'red',
                        description: 'Inhibitor Destroyed',
                        gameSeconds
                    });
                }
                
                if (frame.redTeam.inhibitors > previousFrame.redTeam.inhibitors) {
                    events.push({
                        timestamp: currentTimestamp,
                        type: 'inhibitor',
                        team: 'blue',
                        description: 'Inhibitor Destroyed',
                        gameSeconds
                    });
                }

                // Check for towers (beyond first)
                if (frame.blueTeam.towers < previousFrame.blueTeam.towers) {
                    events.push({
                        timestamp: currentTimestamp,
                        type: 'tower',
                        team: 'red',
                        description: 'Tower Destroyed',
                        gameSeconds
                    });
                }
                
                if (frame.redTeam.towers < previousFrame.redTeam.towers) {
                    events.push({
                        timestamp: currentTimestamp,
                        type: 'tower',
                        team: 'blue',
                        description: 'Tower Destroyed',
                        gameSeconds
                    });
                }
            }

            previousFrame = frame;
        });

        return events.sort((a, b) => a.timestamp - b.timestamp);
    }, [frames]);

    // Combine objective events with teamfight events
    const allEvents = useMemo(() => {
        const combined = [...objectiveEvents];
        
        // Add teamfight events
        teamfightEvents.forEach(tf => {
            const team =
                tf.winner === 'neutral'
                    ? 'neutral'
                    : tf.winner;
            combined.push({
                timestamp: tf.timestamp,
                type: 'teamfight',
                team,
                description: tf.description,
                gameSeconds: tf.gameSeconds
            });
        });

        return combined.sort((a, b) => a.timestamp - b.timestamp);
    }, [objectiveEvents, teamfightEvents, frames]);

    const getEventIcon = (type: string, description?: string) => {
        switch (type) {
            case 'firstBlood':
                return <KillSVG className="event-icon" />;
            case 'firstTower':
            case 'tower':
                return <TowerSVG className="event-icon" />;
            case 'dragon': {
                // Extract dragon type from description
                let dragonType = 'infernal'; // default
                if (description) {
                    // Match patterns like "Ocean Dragon", "Infernal Dragon", etc.
                    const match = description.match(/(\w+)\s+Dragon/);
                    if (match && match[1]) {
                        dragonType = match[1].toLowerCase();
                    }
                }
                return getDragonSVG(dragonType);
            }
            case 'baron':
                return <BaronSVG className="event-icon" />;
            case 'inhibitor':
                return <InhibitorSVG className="event-icon" />;
            case 'teamfight':
                return <KillSVG className="event-icon" />;
            default:
                return null;
        }
    };

    const getDragonSVG = (dragonName: string) => {
        switch (dragonName.toLowerCase()) {
            case "ocean": return <OceanDragonSVG className="event-icon" />;
            case "infernal": return <InfernalDragonSVG className="event-icon" />;
            case "cloud": return <CloudDragonSVG className="event-icon" />;
            case "mountain": return <MountainDragonSVG className="event-icon" />;
            case "hextech": return <HextechDragonSVG className="event-icon" />;
            case "chemtech": return <ChemtechDragonSVG className="event-icon" />;
            case "elder": return <ElderDragonSVG className="event-icon" />;
            default: return <InfernalDragonSVG className="event-icon" />;
        }
    };

    const formatGameTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEventClick = (timestamp: number) => {
        onTimestampClick(timestamp);
    };

    if (!allEvents.length) {
        return (
            <div className="objective-timeline-container">
                <div className="timeline-header">Objective Timeline</div>
                <div className="timeline-empty">No objectives taken yet</div>
            </div>
        );
    }

    return (
        <div className="objective-timeline-container">
            <div className="timeline-header">Objective Timeline</div>
            <div className="timeline-events">
                {allEvents.map((event, index) => (
                    <div
                        key={`${event.timestamp}-${index}`}
                        className={`timeline-event ${event.team} ${event.type}`}
                        onClick={() => handleEventClick(event.timestamp)}
                    >
                        <div className="event-time">
                            {formatGameTime(event.gameSeconds)}
                        </div>
                        <div className="event-icon-container">
                            {getEventIcon(event.type, event.description)}
                        </div>
                        <div className="event-description">
                            {event.description}
                        </div>
                        {selectedTimestamp === event.timestamp && (
                            <div className="event-selected-indicator">●</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
