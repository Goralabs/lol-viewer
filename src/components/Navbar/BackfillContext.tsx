import React, { Dispatch, SetStateAction, createContext, useContext, useEffect, useState } from "react";

export type BackfillState = "enabled" | "disabled";

interface BackfillContextProps {
    backfillState: BackfillState;
    setBackfillState: Dispatch<SetStateAction<BackfillState>>;
    isBackfillEnabled: boolean;
}

export const BackfillContext = createContext<BackfillContextProps>({
    backfillState: "enabled",
    setBackfillState: () => {},
    isBackfillEnabled: true,
} as BackfillContextProps);

interface BackfillProviderProps {
    children: React.ReactNode;
}

export const BackfillProvider: React.FC<BackfillProviderProps> = ({children}) => {
    const [backfillState, setBackfillState] = useState<BackfillState>(() => {
        const saved = localStorage.getItem("backfill");
        return (saved === "disabled" ? "disabled" : "enabled") as BackfillState;
    });

    useEffect(() => {
        localStorage.setItem("backfill", backfillState);
    }, [backfillState]);

    return (
        <BackfillContext.Provider value={{
            backfillState,
            setBackfillState,
            isBackfillEnabled: backfillState === "enabled",
        }}>
            {children}
        </BackfillContext.Provider>
    );
};

export const useBackfill = () => useContext(BackfillContext);