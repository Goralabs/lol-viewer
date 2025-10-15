import './styles/livegameStyle.css'
import {LiveGameCard} from "./LiveGameCard";
import {ScheduleGameCard} from "./ScheduleGameCard";

import {Event as LiveEvent} from "./types/liveGameTypes";
import {Event as TodayEvent} from "./types/scheduleType";

import {ReactComponent as Galaxy} from "../../assets/images/galaxy.svg"
import { useEffect } from "react";

type Props = {
    liveGames: LiveEvent[];
    todayGames: TodayEvent[];
}

export function GameCardList({ liveGames, todayGames }: Props) {
    useEffect(() => {
        document.title = "LoL Live Esports";
    }, []);
    const hasLive = Array.isArray(liveGames) && liveGames.length > 0;

    return (
        <div>
            {hasLive ? (
                <>
                    <LiveGames liveGames={liveGames} />
                    <div className="games-separator" />
                    <TodayGames todayGames={todayGames} />
                </>
            ) : (
                <>
                    <div className="empty-games-inline">
                        <Galaxy className="empty-games-inline-icon" />
                        <h3 className="empty-games-inline-text">NO LIVE GAMES</h3>
                    </div>
                    <div className="games-separator" />
                    <TodayGames todayGames={todayGames} />
                </>
            )}
        </div>
    );
}

type PropsLive = {
    liveGames: LiveEvent[];
}

function LiveGames({liveGames}: PropsLive) {
    if (liveGames !== undefined && liveGames.length !== 0) {
        return (
            <div className="games-list-container">
                <div className="games-list-items">
                    {liveGames.map(game => (
                        <LiveGameCard
                            key={game.id}
                            game={game}
                        />
                    ))}
                </div>
            </div>
        );
    }else {
        return (
            <div className="empty-games-list-container">
                <Galaxy className="empty-games-galaxy" />
                <h2 className="game-list-items-empty">NO LIVE GAMES</h2>
            </div>
        );
    }
}

type PropsToday = {
    todayGames: TodayEvent[];
}

function TodayGames({todayGames}: PropsToday) {
    if (todayGames !== undefined && todayGames.length !== 0) {

        let date = new Date();

        return (
            <div>
                <h2 className="games-of-day">TODAY'S GAMES</h2>
                <div className="games-list-container">
                    <div className="games-list-items">
                        {todayGames.map(game => (
                            <ScheduleGameCard
                                key={game.match.id}
                                game={game}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }else{
        return (
            <div/>
        );
    }
}
