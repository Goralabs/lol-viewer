import React, { useMemo } from 'react';
import { Frame as FrameWindow } from './types/windowLiveTypes';
import { ReactComponent as OceanDragonSVG } from '../../assets/images/dragon-ocean.svg';
import { ReactComponent as InfernalDragonSVG } from '../../assets/images/dragon-infernal.svg';
import { ReactComponent as CloudDragonSVG } from '../../assets/images/dragon-cloud.svg';
import { ReactComponent as MountainDragonSVG } from '../../assets/images/dragon-mountain.svg';
import { ReactComponent as ElderDragonSVG } from '../../assets/images/dragon-elder.svg';
import { ReactComponent as HextechDragonSVG } from '../../assets/images/dragon-hextech.svg';
import { ReactComponent as ChemtechDragonSVG } from '../../assets/images/dragon-chemtech.svg';
import './styles/dragonSoulTracker.css';

interface DragonState {
    type: string;
    count: number;
    hasSoul: boolean;
    hasElder: boolean;
}

interface DragonSoulTrackerProps {
    frames: FrameWindow[];
}

const DRAGON_TYPES = ['ocean', 'infernal', 'cloud', 'mountain', 'hextech', 'chemtech', 'elder'] as const;

function processDragonTypes(dragons: string[]): Record<string, DragonState> {
    const state: Record<string, DragonState> = {};

    DRAGON_TYPES.forEach((type) => {
        state[type] = {
            type,
            count: 0,
            hasSoul: false,
            hasElder: false,
        };
    });

    dragons.forEach((dragon) => {
        const normalizedType = dragon.toLowerCase();
        if (!state[normalizedType]) {
            return;
        }

        state[normalizedType].count += 1;

        if (normalizedType === 'elder') {
            state[normalizedType].hasElder = true;
            return;
        }

        if (state[normalizedType].count >= 4) {
            state[normalizedType].hasSoul = true;
        }
    });

    return state;
}

export function DragonSoulTracker({ frames }: DragonSoulTrackerProps) {
    // Analyze dragon state from frames
    const dragonState = useMemo(() => {
        if (!frames.length) {
            return {
                blue: {} as Record<string, DragonState>,
                red: {} as Record<string, DragonState>,
                soulPoint: null as 'blue' | 'red' | null,
                soulWinner: null as 'blue' | 'red' | null
            };
        }

        const lastFrame = frames[frames.length - 1];
        
        // Process blue team dragons
        const blueDragons = processDragonTypes(lastFrame.blueTeam.dragons || []);
        
        // Process red team dragons
        const redDragons = processDragonTypes(lastFrame.redTeam.dragons || []);
        
        // Determine soul point (first to 3 dragons of any type)
        const blueTotal = Object.values(blueDragons).reduce((sum, dragon) => sum + dragon.count, 0);
        const redTotal = Object.values(redDragons).reduce((sum, dragon) => sum + dragon.count, 0);
        
        let soulPoint: 'blue' | 'red' | null = null;
        if (blueTotal >= 3 && blueTotal > redTotal) {
            soulPoint = 'blue';
        } else if (redTotal >= 3 && redTotal > blueTotal) {
            soulPoint = 'red';
        }
        
        // Determine soul winner (first to 4 dragons of same type)
        let soulWinner: 'blue' | 'red' | null = null;
        const soulEligibleTypes = ['ocean', 'infernal', 'cloud', 'mountain', 'hextech', 'chemtech'];
        
        for (const dragonType of soulEligibleTypes) {
            if (blueDragons[dragonType]?.count >= 4) {
                soulWinner = 'blue';
                break;
            }
            if (redDragons[dragonType]?.count >= 4) {
                soulWinner = 'red';
                break;
            }
        }
        
        return {
            blue: blueDragons,
            red: redDragons,
            soulPoint,
            soulWinner
        };
    }, [frames]);

    const getDragonIcon = (dragonType: string) => {
        switch (dragonType.toLowerCase()) {
            case "ocean": return <OceanDragonSVG className="dragon-icon" />;
            case "infernal": return <InfernalDragonSVG className="dragon-icon" />;
            case "cloud": return <CloudDragonSVG className="dragon-icon" />;
            case "mountain": return <MountainDragonSVG className="dragon-icon" />;
            case "hextech": return <HextechDragonSVG className="dragon-icon" />;
            case "chemtech": return <ChemtechDragonSVG className="dragon-icon" />;
            case "elder": return <ElderDragonSVG className="dragon-icon" />;
            default: return <InfernalDragonSVG className="dragon-icon" />;
        }
    };

    const getDragonDisplayName = (dragonType: string) => {
        switch (dragonType.toLowerCase()) {
            case "ocean": return "Ocean";
            case "infernal": return "Infernal";
            case "cloud": return "Cloud";
            case "mountain": return "Mountain";
            case "hextech": return "Hextech";
            case "chemtech": return "Chemtech";
            case "elder": return "Elder";
            default: return dragonType;
        }
    };

    const renderDragonRow = (dragonType: string) => {
        const blueDragon = dragonState.blue[dragonType];
        const redDragon = dragonState.red[dragonType];
        
        // Skip dragon types that neither team has
        if (blueDragon.count === 0 && redDragon.count === 0 && dragonType !== 'elder') {
            return null;
        }
        
        return (
            <div key={dragonType} className="dragon-row">
                <div className="dragon-team blue">
                    <div className="dragon-count">
                        {Array.from({ length: Math.min(blueDragon.count, 4) }).map((_, index) => (
                            <div
                                key={index}
                                className={`dragon-slate ${blueDragon.hasSoul ? 'soul' : ''} ${blueDragon.hasElder ? 'elder' : ''}`}
                            >
                                {getDragonIcon(dragonType)}
                            </div>
                        ))}
                        {blueDragon.count > 4 && (
                            <div className="dragon-more">+{blueDragon.count - 4}</div>
                        )}
                    </div>
                </div>
                
                <div className="dragon-info">
                    <div className="dragon-type">{getDragonDisplayName(dragonType)}</div>
                    {blueDragon.hasSoul && (
                        <div className="soul-indicator blue">SOUL</div>
                    )}
                    {redDragon.hasSoul && (
                        <div className="soul-indicator red">SOUL</div>
                    )}
                </div>
                
                <div className="dragon-team red">
                    <div className="dragon-count">
                        {Array.from({ length: Math.min(redDragon.count, 4) }).map((_, index) => (
                            <div
                                key={index}
                                className={`dragon-slate ${redDragon.hasSoul ? 'soul' : ''} ${redDragon.hasElder ? 'elder' : ''}`}
                            >
                                {getDragonIcon(dragonType)}
                            </div>
                        ))}
                        {redDragon.count > 4 && (
                            <div className="dragon-more">+{redDragon.count - 4}</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const blueTotal = Object.values(dragonState.blue).reduce((sum, dragon) => sum + dragon.count, 0);
    const redTotal = Object.values(dragonState.red).reduce((sum, dragon) => sum + dragon.count, 0);

    return (
        <div className="dragon-soul-tracker-container">
            <div className="dragon-soul-header">
                <span>Dragon Soul Tracker</span>
                {dragonState.soulPoint && (
                    <div className={`soul-point-badge ${dragonState.soulPoint}`}>
                        {dragonState.soulPoint.toUpperCase()} SOUL POINT
                    </div>
                )}
                {dragonState.soulWinner && (
                    <div className={`soul-winner-badge ${dragonState.soulWinner}`}>
                        {dragonState.soulWinner.toUpperCase()} SOUL
                    </div>
                )}
            </div>
            
            <div className="dragon-totals">
                <div className="dragon-total blue">
                    <span className="total-label">Blue Dragons</span>
                    <span className="total-count">{blueTotal}</span>
                </div>
                <div className="dragon-total red">
                    <span className="total-count">{redTotal}</span>
                    <span className="total-label">Red Dragons</span>
                </div>
            </div>
            
            <div className="dragon-rows">
                {DRAGON_TYPES.map(renderDragonRow)}
            </div>
        </div>
    );
}
