import React, { Dispatch, SetStateAction } from "react";
import { Theme } from './Theme'
import { THEMES } from './Themes'

export type ThemeType = "dark" | "light";

interface ThemeContextProps {
    themeType: ThemeType;
    theme: Theme;
    setCurrentTheme: Dispatch<SetStateAction<ThemeType>>;
}

export const ThemeContext = React.createContext<ThemeContextProps>({
    themeType: "dark",
    theme: THEMES["dark"],
} as ThemeContextProps);

interface ThemeProviderProps {
    children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({children}) => {
    const [currentTheme, setCurrentTheme] = React.useState<ThemeType>("light");

    return (
        <ThemeContext.Provider value={{
            themeType: currentTheme,
            theme: THEMES[currentTheme],
            setCurrentTheme,
        }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => React.useContext(ThemeContext);