import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Frame as FrameWindow } from './types/windowLiveTypes';
import { toEpochMillis } from '../../utils/timestampUtils';
import './styles/goldGraph.css';

interface GoldGraphProps {
    frames: FrameWindow[];
    selectedTimestamp: number | null;
    onTimestampClick: (timestamp: number) => void;
    height?: number;
    teamfightMarkers?: Array<{ timestamp: number; label: string }>;
}


export function GoldGraph({
    frames,
    selectedTimestamp,
    onTimestampClick,
    height = 200,
    teamfightMarkers = []
}: GoldGraphProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const updateWidth = () => setContainerWidth(element.clientWidth);

        updateWidth();

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(entries => {
                if (!entries.length) return;
                const { width: observedWidth } = entries[0].contentRect;
                setContainerWidth(Math.max(observedWidth, 0));
            });

            observer.observe(element);
            return () => observer.disconnect();
        }

        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // Process frame data into chart-friendly format
    const goldData = useMemo(() => {
        if (!frames.length) return [];

        return frames.map(frame => ({
            timestamp: toEpochMillis(frame.rfc460Timestamp),
            blueGold: frame.blueTeam.totalGold,
            redGold: frame.redTeam.totalGold,
            goldDiff: frame.blueTeam.totalGold - frame.redTeam.totalGold
        }));
    }, [frames]);

    // Calculate chart dimensions and scales
    const chartDimensions = useMemo(() => {
        if (!goldData.length) return null;

        const padding = { top: 20, right: 40, bottom: 30, left: 50 };
        const width = containerWidth || containerRef.current?.clientWidth || 800;
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        const minTimestamp = Math.min(...goldData.map(d => d.timestamp));
        const maxTimestamp = Math.max(...goldData.map(d => d.timestamp));
        
        const goldValues = goldData.flatMap(d => [d.blueGold, d.redGold]);
        const minGold = Math.min(...goldValues);
        const maxGold = Math.max(...goldValues);
        
        const goldDiffValues = goldData.map(d => d.goldDiff);
        const minDiff = Math.min(...goldDiffValues);
        const maxDiff = Math.max(...goldDiffValues);
        const maxAbsDiff = Math.max(Math.abs(minDiff), Math.abs(maxDiff));

        const timestampRange = Math.max(maxTimestamp - minTimestamp, 1);
        const goldRange = Math.max(maxGold - minGold, 1);
        const diffRange = Math.max(maxAbsDiff, 1);

        return {
            padding,
            width,
            height,
            chartWidth,
            chartHeight,
            xScale: (timestamp: number) => 
                ((timestamp - minTimestamp) / timestampRange) * chartWidth + padding.left,
            yScale: (gold: number) => 
                chartHeight - ((gold - minGold) / goldRange) * chartHeight + padding.top,
            diffScale: (diff: number) => 
                chartHeight / 2 - (diff / diffRange) * (chartHeight / 2) + padding.top,
            minTimestamp,
            maxTimestamp,
            minGold,
            maxGold,
            maxAbsDiff: diffRange
        };
    }, [goldData, height, containerWidth]);

    // Draw the chart on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !chartDimensions || !goldData.length) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const {
            padding,
            width,
            height,
            chartWidth,
            chartHeight,
            xScale,
            yScale,
            diffScale,
            minTimestamp,
            maxTimestamp,
            minGold,
            maxGold
        } = chartDimensions;

        // Set canvas size for high DPI displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }

        // Vertical grid lines (time markers)
        const timeMarkers = 5;
        for (let i = 0; i <= timeMarkers; i++) {
            const x = padding.left + (chartWidth / timeMarkers) * i;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        }

        // Draw zero line for gold difference
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top + chartHeight / 2);
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight / 2);
        ctx.stroke();

        // Draw gold lines
        ctx.lineWidth = 2;
        
        // Blue team gold
        ctx.strokeStyle = '#1DA1F2';
        ctx.beginPath();
        goldData.forEach((point, index) => {
            const x = xScale(point.timestamp);
            const y = yScale(point.blueGold);
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Red team gold
        ctx.strokeStyle = '#E0245E';
        ctx.beginPath();
        goldData.forEach((point, index) => {
            const x = xScale(point.timestamp);
            const y = yScale(point.redGold);
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw gold difference area
        ctx.fillStyle = 'rgba(29, 161, 242, 0.2)';
        ctx.beginPath();
        goldData.forEach((point, index) => {
            const x = xScale(point.timestamp);
            const y = diffScale(point.goldDiff);
            if (index === 0) {
                ctx.moveTo(x, padding.top + chartHeight / 2);
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.lineTo(xScale(goldData[goldData.length - 1].timestamp), padding.top + chartHeight / 2);
        ctx.closePath();
        ctx.fill();

        // Draw teamfight markers
        teamfightMarkers.forEach(marker => {
            const x = xScale(marker.timestamp);
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        });

        // Draw selected timestamp line
        if (selectedTimestamp) {
            const x = xScale(selectedTimestamp);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw labels
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        
        // Time labels
        const gameTimeMs = maxTimestamp - minTimestamp;
        for (let i = 0; i <= timeMarkers; i++) {
            const x = padding.left + (chartWidth / timeMarkers) * i;
            const timeAtMarker = minTimestamp + (gameTimeMs / timeMarkers) * i;
            const minutes = Math.floor((timeAtMarker - minTimestamp) / 60000);
            ctx.fillText(`${minutes}m`, x, height - 10);
        }

        // Gold value labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            const goldValue = maxGold - ((maxGold - minGold) / 5) * i;
            ctx.fillText(`${Math.round(goldValue / 1000)}k`, padding.left - 10, y + 4);
        }

    }, [goldData, chartDimensions, selectedTimestamp, teamfightMarkers]);

    // Handle canvas click
    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !chartDimensions) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        // Convert click position to timestamp
        const { padding, chartWidth, minTimestamp, maxTimestamp } = chartDimensions;
        if (x < padding.left || x > padding.left + chartWidth) return;

        const clickRatio = (x - padding.left) / chartWidth;
        const clickedTimestamp = minTimestamp + (maxTimestamp - minTimestamp) * clickRatio;
        
        onTimestampClick(clickedTimestamp);
    };

    if (!goldData.length) {
        return (
            <div className="gold-graph-container" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
                No gold data available
            </div>
        );
    }

    return (
        <div className="gold-graph-container" ref={containerRef} style={{ position: 'relative' }}>
            <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                style={{ cursor: 'pointer', width: '100%', height }}
            />
            <div className="gold-graph-legend">
                <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#1DA1F2' }}></div>
                    <span>Blue Gold</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#E0245E' }}></div>
                    <span>Red Gold</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: 'rgba(29, 161, 242, 0.2)' }}></div>
                    <span>Gold Diff</span>
                </div>
                {teamfightMarkers.length > 0 && (
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#FFD700' }}></div>
                        <span>Teamfights</span>
                    </div>
                )}
            </div>
        </div>
    );
}
