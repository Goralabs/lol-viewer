import {useEffect, useState, MouseEvent} from "react";
import './styles/navbarStyle.css'
import { safeGetItem, safeSetItem } from "../../utils/safeStorage";

export function SoundToggler() {
    const [toggled, setToggled] = useState(false);

    useEffect(() => {
        const soundData = safeGetItem("sound");
        if(soundData) {
            if (soundData === "mute") {
                setToggled(false);
            } else if (soundData === "unmute") {
                setToggled(true)
            }
        }
    }, []); // Add empty dependency array to run only once on mount

    const handleClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if(toggled) {
            safeSetItem("sound", "mute");
        }else{
            safeSetItem("sound", "unmute");
        }

        setToggled((s) => !s);
    }

    return (
        <div className="toggle-container">
            <div onClick={handleClick} className={`sound-toggle${toggled ? " muted" : ""}`}>
                <div className="notch">{`${toggled ? "🔊" : "🔈"}`}</div>
            </div>
            <div className="toggle-tooltip">
                {toggled ? "Sound On" : "Sound Muted"}
            </div>
        </div>
    );
}