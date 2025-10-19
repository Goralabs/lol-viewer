import React, { useState } from "react";
import "./styles/playerStatusStyle.css";
import "./styles/timelineScrubber.css";
import { useBackfill } from "../Navbar/BackfillContext";

interface TimelineScrubberProps {
  timestamps: number[];
  value: number | null; // epoch millis or null for live
  onChange: (epoch: number) => void;
  onLive: () => void;
  disabled: boolean;
  isBackfilling: boolean;
  
  // Live playback props
  isLivePaused: boolean;
  speedFactor: number;
  displayedTs: number | null;
  pauseLive: () => void;
  resumeLive: () => void;
  setSpeedFactor: (factor: number) => void;
  
  // Optional props for backward compatibility
  desiredLagMs?: number;
  setDesiredLagMs?: (ms: number) => void;
}

export function TimelineScrubber({
  timestamps,
  value,
  onChange,
  onLive,
  disabled,
  isBackfilling,
  
  // Live playback props
  isLivePaused,
  speedFactor,
  displayedTs,
  pauseLive,
  resumeLive,
  setSpeedFactor,
}: TimelineScrubberProps) {
  const { isBackfillEnabled } = useBackfill();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  if (timestamps.length === 0) {
    return null;
  }

  // Convert epoch millis to minutes:seconds format
  const formatTime = (epoch: number) => {
    const firstTimestamp = timestamps[0];
    const seconds = Math.floor((epoch - firstTimestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Format lag time for display
  const formatLag = (lagMs: number) => {
    const seconds = Math.floor(lagMs / 1000);
    return `${seconds}s`;
  };

  // Find the index of the current value
  const getCurrentIndex = () => {
    if (value === null) {
      // In live mode, show the displayed frame if available, otherwise the latest
      if (displayedTs !== null) {
        const index = timestamps.findIndex(ts => ts === displayedTs);
        return index >= 0 ? index : timestamps.length - 1;
      }
      return timestamps.length - 1; // Live position
    }
    const index = timestamps.findIndex(ts => ts === value);
    return index >= 0 ? index : timestamps.length - 1;
  };

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    onChange(timestamps[index]);
  };

  // Handle pause/resume
  const handlePauseResume = () => {
    if (isLivePaused) {
      resumeLive();
    } else {
      pauseLive();
    }
  };

  // Handle speed change
  const handleSpeedChange = (factor: number) => {
    setSpeedFactor(factor);
    setShowSpeedMenu(false);
  };

  const currentIndex = getCurrentIndex();
  const minTime = timestamps[0];
  const maxTime = timestamps[timestamps.length - 1];
  const currentTime = value !== null ? value : (displayedTs || maxTime);
  const isLiveMode = value === null;

  // Calculate current lag for display (only used in live mode)
  // Since we removed desiredLagMs, we'll use a default value for display
  const DEFAULT_LAG_MS = 10000; // 10 seconds default
  const currentLag = displayedTs !== null ? maxTime - displayedTs : DEFAULT_LAG_MS;

  return (
    <div className="timeline-scrubber">
      <div className="timeline-controls">
        <button
          className={`timeline-live-button ${isLiveMode && !isLivePaused ? "active" : ""}`}
          onClick={onLive}
          disabled={disabled}
        >
          LIVE
        </button>
        
        {/* Pause/Resume button - only show in manual mode (not live) */}
        {!isLiveMode && (
          <button
            className={`timeline-pause-button ${isLivePaused ? "paused" : ""}`}
            onClick={handlePauseResume}
            disabled={disabled}
            title={isLivePaused ? "Resume playback" : "Pause playback"}
          >
            {isLivePaused ? "▶" : "⏸"}
          </button>
        )}
        
        {/* Speed control - only show in manual mode (not live) */}
        {!isLiveMode && (
          <div className="timeline-speed-container">
            <button
              className="timeline-speed-button"
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              disabled={disabled}
              title={`Playback speed: ${speedFactor.toFixed(1)}x`}
            >
              {speedFactor.toFixed(1)}×
            </button>
            
            {showSpeedMenu && (
              <div className="timeline-speed-menu">
                <button
                  className={speedFactor === 0.5 ? "active" : ""}
                  onClick={() => handleSpeedChange(0.5)}
                >
                  0.5×
                </button>
                <button
                  className={speedFactor === 1.0 ? "active" : ""}
                  onClick={() => handleSpeedChange(1.0)}
                >
                  1.0×
                </button>
                <button
                  className={speedFactor === 1.5 ? "active" : ""}
                  onClick={() => handleSpeedChange(1.5)}
                >
                  1.5×
                </button>
                <button
                  className={speedFactor === 2.0 ? "active" : ""}
                  onClick={() => handleSpeedChange(2.0)}
                >
                  2.0×
                </button>
                <button
                  className={speedFactor === 5.0 ? "active" : ""}
                  onClick={() => handleSpeedChange(5.0)}
                >
                  5.0×
                </button>
              </div>
            )}
          </div>
        )}
        
        {isBackfilling && (
          <span className="timeline-status">Loading match history...</span>
        )}
        
        {!isBackfillEnabled && (
          <span className="timeline-status timeline-status-warning">Live Only Mode</span>
        )}
        
        {/* Live buffer status - only show in live mode */}
        {isLiveMode && !isBackfilling && (
          <span className="timeline-status timeline-buffer-info" title={`Buffer: ${formatLag(currentLag)} behind live`}>
            LIVE {isLivePaused ? "(PAUSED)" : `(-${formatLag(currentLag)})`}
          </span>
        )}
        
        {/* Manual mode indicator - only show in manual mode */}
        {!isLiveMode && (
          <span className="timeline-status timeline-manual-info">
            MANUAL {isLivePaused ? "(PAUSED)" : "(PLAYING)"}
          </span>
        )}
      </div>

      <div className="timeline-slider-container">
        <span className="timeline-time">{formatTime(minTime)}</span>
        
        <input
          type="range"
          min="0"
          max={timestamps.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          disabled={disabled || !isBackfillEnabled}
          className="timeline-slider"
          title={!isBackfillEnabled ? "Timeline disabled - backfill is turned off" : ""}
        />
        
        <span className="timeline-time">
          {isLiveMode && isLivePaused ? "PAUSED" :
           (isLiveMode ? "LIVE" : formatTime(currentTime))}
        </span>
      </div>
    </div>
  );
}