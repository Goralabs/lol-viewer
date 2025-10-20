import React, { Dispatch, SetStateAction, createContext, useContext, useEffect, useState, useCallback } from "react";

export type BackfillState = "enabled" | "disabled";

interface BackfillContextProps {
    backfillState: BackfillState;
    setBackfillState: Dispatch<SetStateAction<BackfillState>>;
    isBackfillEnabled: boolean;
    stopBackfill?: () => void; // Optional function to stop ongoing backfill
}

export const BackfillContext = createContext<BackfillContextProps>({
    backfillState: "enabled",
    setBackfillState: () => {},
    isBackfillEnabled: true,
    stopBackfill: () => {},
} as BackfillContextProps);

interface BackfillProviderProps {
    children: React.ReactNode;
}

export const BackfillProvider: React.FC<BackfillProviderProps> = ({children}) => {
    const [backfillState, setBackfillState] = useState<BackfillState>(() => {
        const saved = localStorage.getItem("backfill");
        return (saved === "disabled" ? "disabled" : "enabled") as BackfillState;
    });
    
    // This will be set by the useFrameIndex hook
    const [stopBackfill, setStopBackfill] = useState<(() => void) | undefined>(() => undefined);

    useEffect(() => {
        localStorage.setItem("backfill", backfillState);
    }, [backfillState]);

    // Register the stopBackfill function from the hook
    const registerStopBackfill = useCallback((fn: () => void) => {
        setStopBackfill(() => fn);
    }, []);
    
    // Call stopBackfill when disabling backfill
    const handleSetBackfillState = useCallback((state: BackfillState | ((prev: BackfillState) => BackfillState)) => {
        setBackfillState(prevState => {
            const newState = typeof state === 'function' ? state(prevState) : state;
            
            // If we're disabling backfill, stop any ongoing backfill
            if (prevState === "enabled" && newState === "disabled" && stopBackfill) {
                stopBackfill();
            }
            
            return newState;
        });
    }, [stopBackfill]);

    // Expose a way for the hook to register its stop backfill function
    (window as { __registerStopBackfill?: (fn: () => void) => void }).__registerStopBackfill = registerStopBackfill;

    return (
        <BackfillContext.Provider value={{
            backfillState,
            setBackfillState: handleSetBackfillState,
            isBackfillEnabled: backfillState === "enabled",
            stopBackfill,
        }}>
            {children}
        </BackfillContext.Provider>
    );
};

export const useBackfill = () => useContext(BackfillContext);