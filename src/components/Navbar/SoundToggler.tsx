import React, {useEffect, useState} from "react";
import './styles/navbarStyle.css'

export function SoundToggler() {
    const [toggled, setToggled] = useState(false);

    useEffect(() => {
        const soundData = localStorage.getItem("sound");
        if(soundData) {
            if (soundData === "mute") {
                setToggled(false);
            } else if (soundData === "unmute") {
                setToggled(true)
            }
        }
    }, []); // Add empty dependency array to run only once on mount

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if(toggled) {
            localStorage.setItem("sound", "mute");
        }else{
            localStorage.setItem("sound", "unmute");
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