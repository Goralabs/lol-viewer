import React from "react";
import './styles/navbarStyle.css'
import { useBackfill } from './BackfillContext';

export function BackfillToggler() {
    const { backfillState, setBackfillState } = useBackfill();
    const toggled = backfillState === "enabled";

    const handleClick = () => {
        setBackfillState(toggled ? "disabled" : "enabled");
    }

    return (
        <div className="toggle-container">
            <div onClick={handleClick} className={`backfill-toggle${toggled ? "" : " disabled"}`}>
                <div className="notch">{`${toggled ? "📊" : "🔴"}`}</div>
            </div>
            <div className="toggle-tooltip">
                {toggled ? "Backfill Enabled" : "Backfill Disabled (Live Only)"}
            </div>
        </div>
    );
}