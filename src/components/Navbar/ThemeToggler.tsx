import {useEffect, useState} from "react";
import './styles/navbarStyle.css'

import { useTheme } from "../../theme/ThemeContext";
import { safeGetItem, safeSetItem } from "../../utils/safeStorage";

export function ThemeToggler() {
    const { setCurrentTheme} = useTheme();
    const [toggled, setToggled] = useState(() => {
        const themeData = safeGetItem("theme");
        return themeData ? themeData === "dark" : true;
    });

    useEffect(() => {
        const themeData = safeGetItem("theme");
        if(themeData) {
            if (themeData === "light") {
                setCurrentTheme("light");
            } else {
                setCurrentTheme("dark");
            }
        } else {
            setCurrentTheme("dark");
        }
    }, [setCurrentTheme]);

    const handleClick = () => {
        if(toggled) {
            setCurrentTheme("light");
            safeSetItem("theme", "light");
        }else{
            setCurrentTheme("dark");
            safeSetItem("theme", "dark");
        }

        setToggled((s) => !s);
    }

    return (
        <div className="toggle-container">
            <div onClick={handleClick} className={`theme-toggle${toggled ? " dark" : ""}`}>
                <div className="notch">🌙</div>
            </div>
            <div className="toggle-tooltip">
                {toggled ? "Switch to Light Mode" : "Switch to Dark Mode"}
            </div>
        </div>
    );
}